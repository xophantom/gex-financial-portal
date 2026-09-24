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
function build(row: FakeRow) {
  const repository = { summary: jest.fn(async () => row) };
  const clock = {
    today: jest.fn(() => '2026-09-18'),
    currentMonth: jest.fn(() => '2026-09'),
    timezone: jest.fn(() => 'America/Sao_Paulo'),
  };
  // Redis falso, em memória: suficiente para exercitar get/setNx sem
  // Testcontainers — este teste é sobre a conversão BigInt→Number, não sobre
  // o Redis de verdade (isso já é coberto pelos e2e).
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    setNx: jest.fn(async (key: string, value: string) => {
      if (store.has(key)) return false;
      store.set(key, value);
      return true;
    }),
  };

  return new DashboardService(
    repository as never,
    clock as never,
    redis as never,
  );
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

describe('DashboardService — overflow safety (fix round 1, finding 1)', () => {
  // Number(bigint) acima de Number.MAX_SAFE_INTEGER arredonda em silêncio
  // para o double mais próximo em vez de lançar — exatamente a armadilha que
  // BigIntInterceptor.convert() existe para fechar (Tarefa 7). Este teste
  // prova que o dashboard usa esse mesmo `convert()`, e não Number() direto,
  // no caminho que grava no Redis.
  it('throws instead of silently rounding an amount above Number.MAX_SAFE_INTEGER', async () => {
    const service = build({
      ...baseRow,
      pending_amount_cents: BigInt(Number.MAX_SAFE_INTEGER) + 10n,
    });

    await expect(service.summary(viewer)).rejects.toThrow(/safe integer range/);
  });

  // O valor "fresco" (cache miss) sai do service ainda em BigInt, igual a
  // amount_cents em RequestsService.toResponse() — só o BigIntInterceptor
  // global (na borda HTTP) ou convert() (na gravação no Redis, coberto pelo
  // teste acima) convertem para Number. Chamar o service diretamente, sem
  // passar pelo interceptor, é o que expõe esse tipo intermediário.
  it('keeps the fresh value as BigInt for the HTTP interceptor to convert', async () => {
    const service = build({ ...baseRow, pending_amount_cents: 875_049n });

    const result = await service.summary(viewer);
    expect(result.pending_amount_cents).toBe(875_049n);
    expect(typeof result.pending_amount_cents).toBe('bigint');
  });
});
