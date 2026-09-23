import { describe, expect, it } from 'vitest'
import {
  createRequestSchema,
  decisionSchema,
  listRequestsQuerySchema,
  markPaidSchema,
} from './contracts'

const validRequest = {
  supplier_name: 'Aurora Serviços Digitais',
  supplier_cnpj: '10.000.000/0001-45',
  invoice_number: 'NF-2026-1001',
  amount_cents: 125000,
  competence: '09/2026',
  due_date: '2026-09-10',
  category: 'SOFTWARE',
  description: 'Despesa de teste',
}

describe('createRequestSchema', () => {
  it('normalizes CNPJ and competence on the way in', () => {
    const parsed = createRequestSchema.parse(validRequest)

    expect(parsed.supplier_cnpj).toBe('10000000000145')
    expect(parsed.competence).toBe('2026-09')
  })

  it('rejects an invalid check digit', () => {
    expect(() =>
      createRequestSchema.parse({ ...validRequest, supplier_cnpj: '10000000000146' }),
    ).toThrow()
  })

  it.each([0, -1, 1.5])('rejects the amount %s', (amount_cents) => {
    expect(() =>
      createRequestSchema.parse({ ...validRequest, amount_cents }),
    ).toThrow()
  })

  it('rejects a category outside the enum', () => {
    expect(() =>
      createRequestSchema.parse({ ...validRequest, category: 'OUTROS' }),
    ).toThrow()
  })

  it('accepts a missing description', () => {
    const { description, ...withoutDescription } = validRequest
    expect(() => createRequestSchema.parse(withoutDescription)).not.toThrow()
  })
})

describe('listRequestsQuerySchema', () => {
  it('applies defaults', () => {
    expect(listRequestsQuerySchema.parse({})).toMatchObject({ page: 1, page_size: 20 })
  })

  it('coerces numeric strings coming from the query string', () => {
    expect(listRequestsQuerySchema.parse({ page: '3', page_size: '50' })).toMatchObject({
      page: 3,
      page_size: 50,
    })
  })

  it.each(['0', '-1', 'abc', '1.5'])('rejects page %s', (page) => {
    expect(() => listRequestsQuerySchema.parse({ page })).toThrow()
  })

  it('rejects a page_size above the cap', () => {
    expect(() => listRequestsQuerySchema.parse({ page_size: '101' })).toThrow()
  })

  it('rejects an inverted due-date range', () => {
    expect(() =>
      listRequestsQuerySchema.parse({ due_from: '2026-09-30', due_to: '2026-09-01' }),
    ).toThrow()
  })

  it('accepts a range whose ends are equal', () => {
    expect(() =>
      listRequestsQuerySchema.parse({ due_from: '2026-09-10', due_to: '2026-09-10' }),
    ).not.toThrow()
  })
})

describe('decisionSchema', () => {
  it('requires a reason when rejecting', () => {
    expect(() => decisionSchema.parse({ decision: 'REJECT' })).toThrow()
    expect(() => decisionSchema.parse({ decision: 'REJECT', reason: '   ' })).toThrow()
  })

  it('accepts a rejection with a reason', () => {
    expect(() =>
      decisionSchema.parse({ decision: 'REJECT', reason: 'Nota inconsistente' }),
    ).not.toThrow()
  })

  it('does not require a reason when approving', () => {
    expect(() => decisionSchema.parse({ decision: 'APPROVE' })).not.toThrow()
  })
})

describe('markPaidSchema', () => {
  it('requires both date and reference', () => {
    expect(() => markPaidSchema.parse({ paid_at: '2026-09-18' })).toThrow()
    expect(() => markPaidSchema.parse({ payment_reference: 'PAG-1' })).toThrow()
  })

  it('accepts a plain date and a full ISO timestamp', () => {
    expect(() =>
      markPaidSchema.parse({ paid_at: '2026-09-18', payment_reference: 'PAG-1' }),
    ).not.toThrow()
    expect(() =>
      markPaidSchema.parse({
        paid_at: '2026-09-18T14:00:00-03:00',
        payment_reference: 'PAG-1',
      }),
    ).not.toThrow()
  })

  it('rejects a blank payment reference', () => {
    expect(() =>
      markPaidSchema.parse({ paid_at: '2026-09-18', payment_reference: '  ' }),
    ).toThrow()
  })
})
