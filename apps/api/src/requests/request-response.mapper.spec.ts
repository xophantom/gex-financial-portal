import { toRequestResponse, type RequestWithRequester } from './request-response.mapper'

function row(overrides: Partial<RequestWithRequester> = {}): RequestWithRequester {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    requesterId: '10000000-0000-4000-8000-000000000001',
    supplierName: 'Aurora Serviços Digitais',
    supplierCnpj: '10000000000145',
    invoiceNumber: 'NF-2026-1001',
    amountCents: 125000n,
    competence: '2026-09',
    dueDate: new Date('2026-09-10T00:00:00Z'),
    category: 'SERVICOS',
    description: null,
    status: 'PENDING',
    rejectionReason: null,
    paidAt: null,
    paymentReference: null,
    createdAt: new Date('2026-08-10T12:00:00Z'),
    updatedAt: new Date('2026-08-10T12:00:00Z'),
    requester: { id: '10000000-0000-4000-8000-000000000001', name: 'Ana Solicitante' },
    ...overrides,
  }
}

describe('toRequestResponse', () => {
  it('serializes cents as a number, the due date as a calendar date and the category label', () => {
    const response = toRequestResponse(row(), '2026-09-18')

    expect(response.amount_cents).toBe(125000)
    expect(response.due_date).toBe('2026-09-10')
    expect(response.category).toBe('SERVIÇOS')
    expect(response.paid_at).toBeNull()
  })

  it.each([
    ['PENDING', '2026-09-10', true],
    ['APPROVED', '2026-09-10', true],
    ['PAID', '2026-09-10', false],
    ['REJECTED', '2026-09-10', false],
    ['PENDING', '2026-09-18', false],
  ] as const)('marks a %s request due on %s as overdue: %s', (status, due, overdue) => {
    const response = toRequestResponse(
      row({ status, dueDate: new Date(`${due}T00:00:00Z`) }),
      '2026-09-18',
    )

    expect(response.is_overdue).toBe(overdue)
  })
})
