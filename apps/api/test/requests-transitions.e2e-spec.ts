import type { ErrorEnvelope, RequestDetailResponse } from '@gex/shared'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { createTestApp, TestApp } from './support/test-app'

let app: TestApp
let finance: string
let ana: string
let bruno: string
// Prisma direto: conferir a corrida pela coluna crua, não pelo GET sob teste.
let db: PrismaClient

const PENDING_OF_ANA = '20000000-0000-4000-8000-000000000001'
const APPROVED_ID = '20000000-0000-4000-8000-000000000006'
const REJECTED_ID = '20000000-0000-4000-8000-000000000015'
const PAID_ID = '20000000-0000-4000-8000-000000000010'

beforeAll(async () => {
  app = await createTestApp()
  finance = await app.tokenFor('financeiro@gex.test', 'GexFinance123!')
  ana = await app.tokenFor('solicitante@gex.test', 'GexRequester123!')
  bruno = await app.tokenFor('outro.solicitante@gex.test', 'GexRequester456!')
  db = new PrismaClient()
}, 180_000)

afterAll(async () => {
  await db.$disconnect()
  await app.close()
})

const get = (token: string, id: string) =>
  request(app.server).get(`/requests/${id}`).set('Authorization', `Bearer ${token}`)

const decide = (token: string, id: string, payload: object) =>
  request(app.server)
    .post(`/requests/${id}/decision`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload)

const markPaid = (token: string, id: string, payload: object) =>
  request(app.server)
    .post(`/requests/${id}/mark-paid`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload)

const detailOf = async (token: string, id: string): Promise<RequestDetailResponse> => {
  const response = await get(token, id)
  return response.body as RequestDetailResponse
}

// Promise.all sozinho não garante a sobreposição. Uma segunda conexão prende
// a linha com FOR UPDATE até as N tentativas estarem bloqueadas nela, o que
// torna a disputa determinística.
const waitForBlockedWaiters = async (expected: number, timeoutMs = 5000): Promise<void> => {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    // wait_event_type='Lock' cobre tanto a espera por transactionid quanto
    // por tuple, que se alternam enquanto várias sessões aguardam a linha.
    const rows = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
    `

    if (Number(rows[0]?.count ?? 0n) >= expected) return
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${expected} blocked waiters on requests`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const withHeldLock = async <T>(
  target: string,
  waiters: number,
  run: () => Promise<T>,
): Promise<T> => {
  let lockAcquired = () => {}
  const lockIsHeld = new Promise<void>((resolve) => {
    lockAcquired = resolve
  })
  let releaseHold = () => {}
  const holdReleased = new Promise<void>((resolve) => {
    releaseHold = resolve
  })

  const heldTx = db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM requests WHERE id = ${target}::uuid FOR UPDATE`
      lockAcquired()
      await holdReleased
    },
    // O padrão de 5s do Prisma derrubaria a transação antes da liberação.
    { timeout: 15_000 },
  )

  await lockIsHeld

  try {
    const resultPromise = run()
    await waitForBlockedWaiters(waiters)
    releaseHold()
    return await resultPromise
  } finally {
    releaseHold()
    await heldTx
  }
}

describe('GET /requests/:id', () => {
  it('returns the request with its seeded history', async () => {
    const response = await get(finance, PAID_ID).expect(200)
    const body = response.body as RequestDetailResponse

    expect(body.history).toHaveLength(3)
    expect(body.history.map((event) => event.new_status)).toEqual(['PENDING', 'APPROVED', 'PAID'])
  })

  it('carries the payment reference in the paid audit event', async () => {
    const body = await detailOf(finance, PAID_ID)
    const paidEvent = body.history.at(-1)

    expect(paidEvent?.reason).toBe(body.request.payment_reference)
  })

  it('names the actor of each event', async () => {
    const body = await detailOf(finance, PAID_ID)
    expect(body.history[0].actor.name).toEqual(expect.any(String))
  })

  it('offers approve and reject to finance on a pending request', async () => {
    const body = await detailOf(finance, PENDING_OF_ANA)
    expect(body.allowed_actions).toEqual(['APPROVE', 'REJECT'])
  })

  it('offers no action to the requester who owns it', async () => {
    const body = await detailOf(ana, PENDING_OF_ANA)
    expect(body.allowed_actions).toEqual([])
  })

  it('offers no action on a final state', async () => {
    const body = await detailOf(finance, PAID_ID)
    expect(body.allowed_actions).toEqual([])
  })

  it('refuses a malformed id with 422, like any other invalid input', async () => {
    const response = await get(finance, 'not-a-uuid').expect(422)
    const body = response.body as ErrorEnvelope

    expect(body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
    })
  })

  it("returns 404, not 403, for another requester's request", async () => {
    const response = await get(bruno, PENDING_OF_ANA).expect(404)
    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('POST /requests/:id/decision', () => {
  it('refuses a requester trying to approve', async () => {
    const response = await decide(ana, PENDING_OF_ANA, {
      decision: 'APPROVE',
    }).expect(403)
    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('refuses a requester trying to reject', async () => {
    await decide(ana, PENDING_OF_ANA, {
      decision: 'REJECT',
      reason: 'x',
    }).expect(403)
  })

  it('refuses a rejection without a reason', async () => {
    const response = await decide(finance, PENDING_OF_ANA, {
      decision: 'REJECT',
    }).expect(422)
    const body = response.body as ErrorEnvelope
    expect(body.error.details?.some((d) => d.field === 'reason')).toBe(true)
  })

  it('refuses a rejection whose reason is only whitespace', async () => {
    await decide(finance, PENDING_OF_ANA, {
      decision: 'REJECT',
      reason: '   ',
    }).expect(422)
  })

  it('approves a pending request and appends an audit event', async () => {
    const target = '20000000-0000-4000-8000-000000000002'
    const before = await detailOf(finance, target)

    await decide(finance, target, { decision: 'APPROVE' }).expect(200)
    const after = await detailOf(finance, target)

    expect(after.request.status).toBe('APPROVED')
    expect(after.history).toHaveLength(before.history.length + 1)
    expect(after.history.at(-1)).toMatchObject({
      previous_status: 'PENDING',
      new_status: 'APPROVED',
      actor: { id: '10000000-0000-4000-8000-000000000003' },
    })
  })

  it('refuses approving an already approved request', async () => {
    const response = await decide(finance, APPROVED_ID, {
      decision: 'APPROVE',
    }).expect(409)
    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })

  it.each([REJECTED_ID, PAID_ID])('refuses reverting the final state of %s', async (id) => {
    await decide(finance, id, { decision: 'APPROVE' }).expect(409)
    await decide(finance, id, { decision: 'REJECT', reason: 'x' }).expect(409)
  })

  // withHeldLock pode esperar 5s sozinho; daí o timeout maior que o do Jest.
  it('writes exactly one audit event when two approvals race', async () => {
    const target = '20000000-0000-4000-8000-000000000003'
    const before = await detailOf(finance, target)

    const results = await withHeldLock(target, 3, () =>
      Promise.all([
        decide(finance, target, { decision: 'APPROVE' }),
        decide(finance, target, { decision: 'APPROVE' }),
        decide(finance, target, { decision: 'APPROVE' }),
      ]),
    )

    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(2)

    const after = await detailOf(finance, target)
    expect(after.history).toHaveLength(before.history.length + 1)

    const approvalEvents = await db.requestStatusEvent.findMany({
      where: {
        requestId: target,
        previousStatus: 'PENDING',
        newStatus: 'APPROVED',
      },
    })
    expect(approvalEvents).toHaveLength(1)
  }, 15_000)
})

describe('POST /requests/:id/mark-paid', () => {
  it('refuses marking a pending request as paid', async () => {
    const response = await markPaid(finance, PENDING_OF_ANA, {
      paid_at: '2026-09-18',
      payment_reference: 'PAG-X',
    }).expect(409)

    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })

  it('requires both the date and the reference', async () => {
    await markPaid(finance, APPROVED_ID, { paid_at: '2026-09-18' }).expect(422)
    await markPaid(finance, APPROVED_ID, {
      payment_reference: 'PAG-X',
    }).expect(422)
  })

  it('refuses a payment date in the future', async () => {
    const response = await markPaid(finance, APPROVED_ID, {
      paid_at: '2026-09-19',
      payment_reference: 'PAG-X',
    }).expect(422)

    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([
      { field: 'paid_at', message: 'A data de pagamento não pode ser futura' },
    ])
  })

  it.each([
    '2026-02-31',
    '2026-13-01',
    '2026-09-18Tlixo',
    '2026-09-18T22:00:00-03:00',
    '18/09/2026',
  ])('refuses the malformed payment date %s with 422', async (paid_at) => {
    const response = await markPaid(finance, APPROVED_ID, {
      paid_at,
      payment_reference: 'PAG-X',
    }).expect(422)

    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details?.map((d) => d.field)).toEqual(['paid_at'])
  })

  // A criação às 23h30 em São Paulo já é o dia seguinte em UTC: a regra tem
  // que comparar datas no fuso da aplicação, não em UTC.
  it('refuses a payment dated before the request was created, in São Paulo time', async () => {
    const target = '20000000-0000-4000-8000-000000000008'
    await db.request.update({
      where: { id: target },
      data: { createdAt: new Date('2026-08-17T23:30:00-03:00') },
    })

    const response = await markPaid(finance, target, {
      paid_at: '2026-08-16',
      payment_reference: 'PAG-X',
    }).expect(422)

    const body = response.body as ErrorEnvelope
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([
      {
        field: 'paid_at',
        message: 'A data de pagamento não pode ser anterior à criação da solicitação',
      },
    ])
    expect((await detailOf(finance, target)).request.status).toBe('APPROVED')

    await markPaid(finance, target, {
      paid_at: '2026-08-17',
      payment_reference: 'PAG-MESMO-DIA',
    }).expect(200)
  })

  it('stores the payment date from the payload, not the current time', async () => {
    const target = '20000000-0000-4000-8000-000000000007'

    await markPaid(finance, target, {
      paid_at: '2026-09-15',
      payment_reference: 'PAG-2026-9999',
    }).expect(200)

    const body = await detailOf(finance, target)

    expect(body.request.paid_at?.slice(0, 10)).toBe('2026-09-15')
    expect(body.request.paid_at).not.toBe(body.request.created_at)
    expect(body.history.at(-1)?.reason).toBe('PAG-2026-9999')
  })

  it('anchors a plain date at midday in São Paulo, never crossing the day', async () => {
    const target = '20000000-0000-4000-8000-000000000009'

    await markPaid(finance, target, {
      paid_at: '2026-09-01',
      payment_reference: 'PAG-2026-8888',
    }).expect(200)

    const body = await detailOf(finance, target)
    const inSaoPaulo = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(body.request.paid_at as string))

    expect(inSaoPaulo).toBe('2026-09-01')
  })

  it('refuses a requester marking anything as paid', async () => {
    await markPaid(ana, APPROVED_ID, {
      paid_at: '2026-09-18',
      payment_reference: 'PAG-X',
    }).expect(403)
  })

  it('writes exactly one audit event when two mark-paid calls race', async () => {
    const target = APPROVED_ID

    const results = await withHeldLock(target, 3, () =>
      Promise.all([
        markPaid(finance, target, {
          paid_at: '2026-09-10',
          payment_reference: 'PAG-RACE',
        }),
        markPaid(finance, target, {
          paid_at: '2026-09-10',
          payment_reference: 'PAG-RACE',
        }),
        markPaid(finance, target, {
          paid_at: '2026-09-10',
          payment_reference: 'PAG-RACE',
        }),
      ]),
    )

    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(2)

    const paidEvents = await db.requestStatusEvent.findMany({
      where: {
        requestId: target,
        previousStatus: 'APPROVED',
        newStatus: 'PAID',
      },
    })
    expect(paidEvents).toHaveLength(1)

    const row = await db.request.findUniqueOrThrow({
      where: { id: target },
    })
    expect(row.status).toBe('PAID')
    expect(row.paymentReference).toBe('PAG-RACE')
  }, 15_000)
})
