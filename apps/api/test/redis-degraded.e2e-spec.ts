import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DashboardSummaryResponse } from '@gex/shared'
import request from 'supertest'
import { createTestApp, TestApp } from './support/test-app'

interface ExpectedBlock {
  request_count: number
  pending_amount_cents: number
  approved_amount_cents: number
  paid_this_month_amount_cents: number
}

const expected = JSON.parse(
  readFileSync(join(__dirname, '../../../data/expected_results.json'), 'utf8'),
) as { finance: ExpectedBlock }

// ...007 do seed: APPROVED, 78500 centavos, criada em 2026-08-16.
const APPROVED_ID = '20000000-0000-4000-8000-000000000007'
const APPROVED_AMOUNT = 78_500
const NEW_AMOUNT = 12_345

// Cada chamada ao Redis pausado espera o timeout de comando (500ms).
const SLOW_TEST_MS = 30_000

let app: TestApp
let finance: string
let ana: string

beforeAll(async () => {
  app = await createTestApp()
  finance = await app.tokenFor('financeiro@gex.test', 'GexFinance123!')
  ana = await app.tokenFor('solicitante@gex.test', 'GexRequester123!')
}, 180_000)

afterAll(async () => app.close())

// `docker pause` congela o Redis sem fechar a conexão, o pior caso para o
// cliente: nada responde e nada falha. O finally religa mesmo se a asserção
// falhar, para não contaminar os testes seguintes.
async function withRedisDown(run: () => Promise<void>): Promise<void> {
  await app.stopRedis()
  try {
    await run()
  } finally {
    await app.startRedis()
  }
}

const summaryOf = async (token: string): Promise<DashboardSummaryResponse> => {
  const response = await request(app.server)
    .get('/dashboard/summary')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
  return response.body as DashboardSummaryResponse
}

describe('with Redis unavailable', () => {
  let createdId: string

  it(
    'serves the dashboard from the database',
    async () => {
      // Deixa uma entrada no cache antes da queda.
      await summaryOf(finance)

      await withRedisDown(async () => {
        const body = await summaryOf(finance)

        expect(body).toMatchObject({
          request_count: expected.finance.request_count,
          pending_amount_cents: expected.finance.pending_amount_cents,
          approved_amount_cents: expected.finance.approved_amount_cents,
          paid_this_month_amount_cents: expected.finance.paid_this_month_amount_cents,
        })
      })
    },
    SLOW_TEST_MS,
  )

  it(
    'logs in without the rate limit (fail-open)',
    async () => {
      await withRedisDown(async () => {
        await request(app.server)
          .post('/auth/login')
          .send({ email: 'solicitante@gex.test', password: 'GexRequester123!' })
          .expect(200)
      })
    },
    SLOW_TEST_MS,
  )

  it(
    'creates, decides and pays, answering success for every committed write',
    async () => {
      await withRedisDown(async () => {
        const created = await request(app.server)
          .post('/requests')
          .set('Authorization', `Bearer ${ana}`)
          .set('Idempotency-Key', randomUUID())
          .send({
            supplier_name: 'Fornecedor Sem Redis',
            supplier_cnpj: '10.000.000/0001-45',
            invoice_number: `NF-REDIS-${randomUUID().slice(0, 8)}`,
            amount_cents: NEW_AMOUNT,
            competence: '09/2026',
            due_date: '2026-09-30',
            category: 'SOFTWARE',
          })
          .expect(201)
        createdId = (created.body as { id: string }).id

        await request(app.server)
          .post(`/requests/${createdId}/decision`)
          .set('Authorization', `Bearer ${finance}`)
          .send({ decision: 'APPROVE' })
          .expect(200)

        await request(app.server)
          .post(`/requests/${APPROVED_ID}/mark-paid`)
          .set('Authorization', `Bearer ${finance}`)
          .send({ paid_at: '2026-09-15', payment_reference: 'PAG-SEM-REDIS' })
          .expect(200)

        const body = await summaryOf(finance)
        expect(body).toMatchObject({
          request_count: expected.finance.request_count + 1,
          pending_amount_cents: expected.finance.pending_amount_cents,
          approved_amount_cents:
            expected.finance.approved_amount_cents + NEW_AMOUNT - APPROVED_AMOUNT,
          paid_this_month_amount_cents:
            expected.finance.paid_this_month_amount_cents + APPROVED_AMOUNT,
        })
      })
    },
    SLOW_TEST_MS,
  )

  it('reflects the writes made during the outage once Redis is back', async () => {
    const body = await summaryOf(finance)

    expect(body.request_count).toBe(expected.finance.request_count + 1)
    expect(body.paid_this_month_amount_cents).toBe(
      expected.finance.paid_this_month_amount_cents + APPROVED_AMOUNT,
    )
  })
})
