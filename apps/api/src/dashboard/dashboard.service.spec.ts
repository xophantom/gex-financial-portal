import { DashboardService } from './dashboard.service';
import type { Viewer } from '../requests/requests.repository';

const viewer: Viewer = {
  id: '10000000-0000-4000-8000-000000000001',
  role: 'REQUESTER',
};

interface FakeRow {
  pending_amount_cents: bigint;
  approved_amount_cents: bigint;
  paid_this_month_amount_cents: bigint;
  overdue_count: bigint;
  request_count: bigint;
  pending_count: bigint;
  approved_count: bigint;
  rejected_count: bigint;
  paid_count: bigint;
}

/* eslint-disable @typescript-eslint/require-await -- fakes precisam devolver
   Promise para bater com a assinatura real dos métodos assíncronos que
   substituem. */
function build(row: FakeRow, redisUp = true) {
  const repository = { summary: jest.fn(async () => row) };
  const clock = {
    today: jest.fn(() => '2026-09-18'),
    currentMonth: jest.fn(() => '2026-09'),
    timezone: jest.fn(() => 'America/Sao_Paulo'),
  };
  // Redis em memória com a mesma semântica de melhor esforço do real: fora
  // do ar, tudo devolve o valor neutro (null/false).
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) =>
      redisUp ? (store.get(key) ?? null) : null,
    ),
    setNx: jest.fn(async (key: string, value: string) => {
      if (!redisUp || store.has(key)) return false;
      store.set(key, value);
      return true;
    }),
    incrBy: jest.fn(async (key: string, by: number) => {
      if (!redisUp) return null;
      const next = Number(store.get(key) ?? 0) + by;
      store.set(key, String(next));
      return next;
    }),
  };

  const service = new DashboardService(
    repository as never,
    clock as never,
    redis as never,
  );
  return { service, repository, redis };
}
/* eslint-enable @typescript-eslint/require-await */

const baseRow: FakeRow = {
  pending_amount_cents: 0n,
  approved_amount_cents: 0n,
  paid_this_month_amount_cents: 0n,
  overdue_count: 0n,
  request_count: 1n,
  pending_count: 1n,
  approved_count: 0n,
  rejected_count: 0n,
  paid_count: 0n,
};

describe('DashboardService — overflow safety', () => {
  // Number(bigint) arredondaria em silêncio acima de MAX_SAFE_INTEGER.
  it('throws instead of silently rounding an amount above Number.MAX_SAFE_INTEGER', async () => {
    const { service } = build({
      ...baseRow,
      pending_amount_cents: BigInt(Number.MAX_SAFE_INTEGER) + 10n,
    });

    await expect(service.summary(viewer)).rejects.toThrow(/safe integer range/);
  });

  // Só o BigIntInterceptor, na borda HTTP, converte o valor fresco.
  it('keeps the fresh value as BigInt for the HTTP interceptor to convert', async () => {
    const { service } = build({ ...baseRow, pending_amount_cents: 875_049n });

    const result = await service.summary(viewer);
    expect(result.pending_amount_cents).toBe(875_049n);
    expect(typeof result.pending_amount_cents).toBe('bigint');
  });
});

describe('DashboardService — cache', () => {
  it('serves the second read from the cache', async () => {
    const { service, repository } = build(baseRow);

    await service.summary(viewer);
    await service.summary(viewer);

    expect(repository.summary).toHaveBeenCalledTimes(1);
  });

  it('queries again after invalidate()', async () => {
    const { service, repository } = build(baseRow);

    await service.summary(viewer);
    await service.invalidate();
    await service.summary(viewer);

    expect(repository.summary).toHaveBeenCalledTimes(2);
  });

  it('falls back to the database without caching when Redis is down', async () => {
    const { service, repository, redis } = build(
      { ...baseRow, pending_amount_cents: 42n },
      false,
    );

    const first = await service.summary(viewer);
    await service.summary(viewer);
    await expect(service.invalidate()).resolves.toBeUndefined();

    expect(first.pending_amount_cents).toBe(42n);
    expect(repository.summary).toHaveBeenCalledTimes(2);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
