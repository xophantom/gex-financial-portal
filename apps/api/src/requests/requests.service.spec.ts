import { Prisma } from '@prisma/client'
import type { CreateRequestInput } from '@gex/shared'
import type { AuthenticatedUser } from '../auth/authenticated-user'
import { RequestsService } from './requests.service'

const requester: AuthenticatedUser = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Ana',
  email: 'solicitante@gex.test',
  role: 'REQUESTER',
}

const input: CreateRequestInput = {
  supplier_name: 'Fornecedor Teste',
  supplier_cnpj: '10000000000145',
  invoice_number: 'NF-0001',
  amount_cents: 155313,
  competence: '2026-09',
  due_date: '2026-09-30',
  category: 'SOFTWARE',
}

// Fabrica um PrismaClientKnownRequestError de verdade (mesma classe que o
// código de produção testa com instanceof), não um objeto plano com o mesmo
// formato — senão o teste provaria só a forma do erro, não o comportamento
// real do runtime do Prisma.
function fabricateP2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { target },
  })
}

/* eslint-disable @typescript-eslint/require-await -- fakes precisam devolver
   Promise para bater com a assinatura real dos métodos assíncronos que
   substituem. */
function build(
  createImpl: () => Promise<unknown>,
  findOneImpl: () => Promise<unknown> = async () => null,
) {
  const repository = {
    create: jest.fn(createImpl),
    findOne: jest.fn(findOneImpl),
  }
  const clock = { today: jest.fn(() => '2026-09-18') }
  const idempotency = {
    recall: jest.fn(async () => null),
    remember: jest.fn(async () => undefined),
    fingerprint: jest.fn(() => 'fingerprint'),
  }
  const events = { emitAsync: jest.fn(async () => []) }

  return new RequestsService(
    repository as never,
    clock as never,
    idempotency as never,
    events as never,
  )
}
/* eslint-enable @typescript-eslint/require-await */

describe('RequestsService.create — mapping P2002 to DUPLICATE_INVOICE', () => {
  it('maps the (supplier_cnpj, invoice_number) violation to 409 DUPLICATE_INVOICE', async () => {
    const service = build(() => Promise.reject(fabricateP2002(['supplier_cnpj', 'invoice_number'])))

    await expect(service.create(input, requester)).rejects.toMatchObject({
      code: 'DUPLICATE_INVOICE',
      status: 409,
    })
  })

  // Regra do projeto: "não é alcançável hoje" já mordeu quatro vezes. As
  // únicas outras constraints únicas na transação de criação são as chaves
  // primárias (Request.id, RequestStatusEvent.id), geradas por randomUUID()
  // e portanto praticamente nunca colidem — mas no dia em que alguém
  // acrescentar uma nova constraint única a Request ou RequestStatusEvent,
  // este teste é o que impede um P2002 dela de virar "nota duplicada" para
  // o cliente.
  it('does not map a P2002 from a different constraint to DUPLICATE_INVOICE', async () => {
    const error = fabricateP2002(['id'])
    const service = build(() => Promise.reject(error))

    await expect(service.create(input, requester)).rejects.toBe(error)
  })

  it('does not map a P2002 with no meta.target at all', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('no target', {
      code: 'P2002',
      clientVersion: '6.19.3',
    })
    const service = build(() => Promise.reject(error))

    await expect(service.create(input, requester)).rejects.toBe(error)
  })

  it('rethrows non-Prisma errors unchanged', async () => {
    const error = new Error('boom')
    const service = build(() => Promise.reject(error))

    await expect(service.create(input, requester)).rejects.toBe(error)
  })
})

// Linha como o Prisma a devolve (amountCents em BigInt), com o requester e o
// histórico que o repositório inclui.
const storedRow = (amountCents: bigint) => ({
  id: '20000000-0000-4000-8000-000000000001',
  requesterId: requester.id,
  supplierName: 'Fornecedor Teste',
  supplierCnpj: '10000000000145',
  invoiceNumber: 'NF-0001',
  amountCents,
  competence: '2026-09',
  dueDate: new Date('2026-09-30T00:00:00Z'),
  category: 'SERVICOS' as const,
  description: null,
  status: 'PENDING' as const,
  rejectionReason: null,
  paidAt: null,
  paymentReference: null,
  createdAt: new Date('2026-09-01T12:00:00Z'),
  updatedAt: new Date('2026-09-01T12:00:00Z'),
  requester: { id: requester.id, name: requester.name },
  events: [],
})

describe('RequestsService — response mapping', () => {
  it('returns amount_cents as a number and the accented category label', async () => {
    const service = build(
      () => Promise.reject(new Error('unused')),
      () => Promise.resolve(storedRow(155_313n)),
    )

    const { request } = await service.findOne(storedRow(0n).id, requester)

    expect(request.amount_cents).toBe(155_313)
    expect(typeof request.amount_cents).toBe('number')
    expect(request.category).toBe('SERVIÇOS')
  })

  // Number(bigint) arredondaria em silêncio acima de MAX_SAFE_INTEGER.
  it('throws instead of silently rounding an amount above Number.MAX_SAFE_INTEGER', async () => {
    const service = build(
      () => Promise.reject(new Error('unused')),
      () => Promise.resolve(storedRow(BigInt(Number.MAX_SAFE_INTEGER) + 10n)),
    )

    await expect(service.findOne(storedRow(0n).id, requester)).rejects.toThrow(/safe integer range/)
  })
})
