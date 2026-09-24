import { ClockService } from '../src/clock/clock.service';
import type { DashboardSummary } from '../src/dashboard/dashboard.service';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { RedisService } from '../src/redis/redis.service';
import type { Viewer } from '../src/requests/requests.repository';
import { startTestRedis, stopTestRedis } from './testcontainers';

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

const row = (pendingAmountCents: bigint): FakeRow => ({
  pending_amount_cents: pendingAmountCents,
  approved_amount_cents: 0n,
  paid_this_month_amount_cents: 0n,
  overdue_count: 0n,
  request_count: 1n,
  pending_count: 1n,
  approved_count: 0n,
  rejected_count: 0n,
  paid_count: 0n,
});

const viewer: Viewer = {
  id: '10000000-0000-4000-8000-000000000001',
  role: 'FINANCE',
};

// Redis de verdade (Testcontainers), não um fake em memória: a corrida é
// sobre a ordem real de get/setNx/incr no Redis, que um Map em JS não
// reproduz fielmente. O repositório, esse sim, é um dublê controlado à mão
// — é a única forma de segurar a "consulta SQL" em voo pelo tempo exato
// necessário para forçar a interleaving determinística, sem sleep-and-hope
// (mesma preocupação da Tarefa 14 com withHeldLock; aqui quem "trava" é a
// Promise que o dublê devolve, não um lock de linha do Postgres — um SELECT
// agregado comum não bloqueia em FOR UPDATE de outra transação).
describe('DashboardService cache-aside ordering (Task 15 fix round 1, finding 2)', () => {
  let redis: RedisService;
  let clock: ClockService;

  beforeAll(async () => {
    process.env.REDIS_URL = await startTestRedis();
  }, 60_000);

  afterAll(async () => stopTestRedis());

  beforeEach(() => {
    redis = new RedisService();
    clock = new ClockService({ APP_TODAY: '2026-09-18' });
  });

  afterEach(() => {
    redis.onModuleDestroy();
  });

  it('never lets a query that resolves after a concurrent invalidate() poison the cache with a stale total', async () => {
    let resolveSlowQuery: (value: FakeRow) => void = () => {
      throw new Error('resolveSlowQuery called before being assigned');
    };
    let markQueryStarted: () => void = () => {};
    const queryStarted = new Promise<void>((resolve) => {
      markQueryStarted = resolve;
    });

    const repository = {
      summary: jest.fn(() => {
        markQueryStarted();
        return new Promise<FakeRow>((resolve) => {
          resolveSlowQuery = resolve;
        });
      }),
    };
    const service = new DashboardService(repository as never, clock, redis);

    // Leitor A: começa a consultar (a "SQL" fica pendurada até
    // resolveSlowQuery ser chamado, mais abaixo).
    const readA = service.summary(viewer);
    await queryStarted;

    // Escritor B: commita e invalida ENQUANTO a consulta de A ainda está em
    // voo — exatamente a janela que o achado do revisor descreve.
    await service.invalidate();

    // Só agora a consulta "lenta" de A resolve, com o valor PRÉ-escrita.
    resolveSlowQuery(row(100_000n));
    const resultA = (await readA) as DashboardSummary;
    expect(Number(resultA.pending_amount_cents)).toBe(100_000);

    // Leitor C, depois de tudo: tem que ver o valor PÓS-escrita — nunca o
    // que A tentou gravar depois do invalidate() de B.
    const repositoryForC = {
      summary: jest.fn(() => Promise.resolve(row(999_000n))),
    };
    const serviceForC = new DashboardService(
      repositoryForC as never,
      clock,
      redis,
    );
    const resultC = (await serviceForC.summary(viewer)) as DashboardSummary;

    expect(Number(resultC.pending_amount_cents)).toBe(999_000);
    // Confirma que C de fato bateu no repositório (cache miss) — se C
    // tivesse lido o valor que A gravou depois do invalidate, o mock acima
    // nunca seria chamado e este teste passaria pelo motivo errado.
    expect(repositoryForC.summary).toHaveBeenCalledTimes(1);
  });
});
