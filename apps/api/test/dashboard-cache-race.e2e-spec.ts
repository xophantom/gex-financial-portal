import type { AuthenticatedUser } from '../src/auth/authenticated-user'
import type { DashboardSummaryRow } from '../src/dashboard/dashboard.repository'
import { DashboardService } from '../src/dashboard/dashboard.service'
import { ClockService } from '../src/infra/clock/clock.service'
import { RedisService } from '../src/infra/redis/redis.service'
import { startTestRedis, stopTestRedis } from './support/containers'

const row = (pendingAmountCents: bigint): DashboardSummaryRow => ({
  pending_amount_cents: pendingAmountCents,
  approved_amount_cents: 0n,
  paid_this_month_amount_cents: 0n,
  overdue_count: 0n,
  request_count: 1n,
  pending_count: 1n,
  approved_count: 0n,
  rejected_count: 0n,
  paid_count: 0n,
})

const viewer: AuthenticatedUser = {
  id: '10000000-0000-4000-8000-000000000003',
  name: 'Financeiro',
  email: 'financeiro@gex.test',
  role: 'FINANCE',
}

// Redis de verdade para a ordem real dos comandos; o repositório é um dublê
// cuja Promise segura a "consulta" em voo, tornando a intercalação
// determinística sem sleep.
describe('DashboardService cache-aside ordering', () => {
  let redis: RedisService
  let clock: ClockService

  beforeAll(async () => {
    process.env.REDIS_URL = await startTestRedis()
  }, 60_000)

  afterAll(async () => stopTestRedis())

  // onModuleInit espera a conexão: sem ela, os comandos falhariam (sem fila
  // offline) e o teste passaria sem cache nenhum, pelo motivo errado.
  beforeEach(async () => {
    redis = new RedisService()
    await redis.onModuleInit()
    clock = new ClockService({ APP_TODAY: '2026-09-18' })
  })

  afterEach(() => {
    redis.onModuleDestroy()
  })

  it('never lets a query that resolves after a concurrent invalidate() poison the cache with a stale total', async () => {
    let resolveSlowQuery: (value: DashboardSummaryRow) => void = () => {
      throw new Error('resolveSlowQuery called before being assigned')
    }
    let markQueryStarted: () => void = () => {}
    const queryStarted = new Promise<void>((resolve) => {
      markQueryStarted = resolve
    })

    const repository = {
      summary: jest.fn(() => {
        markQueryStarted()
        return new Promise<DashboardSummaryRow>((resolve) => {
          resolveSlowQuery = resolve
        })
      }),
    }
    const service = new DashboardService(repository as never, clock, redis)

    // Leitor A: começa a consultar (a "SQL" fica pendurada até
    // resolveSlowQuery ser chamado, mais abaixo).
    const readA = service.summary(viewer)
    await queryStarted

    // Escritor B: commita e invalida ENQUANTO a consulta de A está em voo.
    await service.invalidate()

    // Só agora a consulta "lenta" de A resolve, com o valor PRÉ-escrita.
    resolveSlowQuery(row(100_000n))
    const resultA = await readA
    expect(resultA.pending_amount_cents).toBe(100_000)

    // Leitor C, depois de tudo: tem que ver o valor PÓS-escrita — nunca o
    // que A tentou gravar depois do invalidate() de B.
    const repositoryForC = {
      summary: jest.fn(() => Promise.resolve(row(999_000n))),
    }
    const serviceForC = new DashboardService(repositoryForC as never, clock, redis)
    const resultC = await serviceForC.summary(viewer)

    expect(resultC.pending_amount_cents).toBe(999_000)
    // Confirma que C de fato bateu no repositório (cache miss) — se C
    // tivesse lido o valor que A gravou depois do invalidate, o mock acima
    // nunca seria chamado e este teste passaria pelo motivo errado.
    expect(repositoryForC.summary).toHaveBeenCalledTimes(1)
  })
})
