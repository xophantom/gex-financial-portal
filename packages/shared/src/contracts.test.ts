import { describe, expect, it } from 'vitest'
import {
  createRequestSchema,
  decisionSchema,
  listRequestsQuerySchema,
  loginSchema,
  markPaidSchema,
} from './contracts.js'

const ENGLISH_DEFAULT = /Required|Invalid enum value|Expected .* received|String must contain/

function firstIssue(result: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } }) {
  if (result.success) throw new Error('expected parsing to fail')
  return result.error!.issues[0]
}

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

  it.each(['2026-02-31', '2026-13-45', '2025-02-29'])(
    'rejects the calendar-invalid due_date %s',
    (due_date) => {
      const result = createRequestSchema.safeParse({ ...validRequest, due_date })
      const issue = firstIssue(result)

      expect(issue.path).toEqual(['due_date'])
      expect(issue.message).toBe('Essa data não existe no calendário')
    },
  )

  it('accepts a real leap day as due_date', () => {
    const result = createRequestSchema.safeParse({ ...validRequest, due_date: '2024-02-29' })
    expect(result.success).toBe(true)
  })

  it('reports a Portuguese message for each missing required field', () => {
    const requiredFields: (keyof typeof validRequest)[] = [
      'supplier_name',
      'supplier_cnpj',
      'invoice_number',
      'amount_cents',
      'competence',
      'due_date',
    ]

    for (const field of requiredFields) {
      const { [field]: _omitted, ...withoutField } = validRequest
      const result = createRequestSchema.safeParse(withoutField)
      const issue = firstIssue(result)

      expect(issue.path).toEqual([field])
      expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
    }
  })

  it('rejects an amount_cents above the business ceiling', () => {
    const result = createRequestSchema.safeParse({
      ...validRequest,
      amount_cents: 100_000_000_001,
    })
    const issue = firstIssue(result)

    expect(issue.message).toBe('O valor não pode passar de R$ 1.000.000.000,00')
  })

  it('rejects an amount_cents corrupted by float64 precision loss', () => {
    const result = createRequestSchema.safeParse({
      ...validRequest,
      amount_cents: Number.MAX_SAFE_INTEGER + 2,
    })
    expect(result.success).toBe(false)
  })

  it('reports a Portuguese message when supplier_name exceeds the cap', () => {
    const result = createRequestSchema.safeParse({
      ...validRequest,
      supplier_name: 'A'.repeat(201),
    })
    const issue = firstIssue(result)

    expect(issue.message).toBe('O nome do fornecedor não pode passar de 200 caracteres')
  })

  it('reports a Portuguese message when invoice_number exceeds the cap', () => {
    const result = createRequestSchema.safeParse({
      ...validRequest,
      invoice_number: 'A'.repeat(61),
    })
    const issue = firstIssue(result)

    expect(issue.message).toBe('O número da nota não pode passar de 60 caracteres')
  })

  it('reports a Portuguese message when description exceeds the cap', () => {
    const result = createRequestSchema.safeParse({
      ...validRequest,
      description: 'A'.repeat(1001),
    })
    const issue = firstIssue(result)

    expect(issue.message).toBe('A descrição não pode passar de 1000 caracteres')
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

  it('rejects a calendar-invalid due_from', () => {
    const result = listRequestsQuerySchema.safeParse({ due_from: '2026-02-31' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['due_from'])
    expect(issue.message).toBe('Essa data não existe no calendário')
  })

  it('rejects a calendar-invalid due_to', () => {
    const result = listRequestsQuerySchema.safeParse({ due_to: '2026-13-45' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['due_to'])
    expect(issue.message).toBe('Essa data não existe no calendário')
  })

  it('rejects an unknown status with a Portuguese message', () => {
    const result = listRequestsQuerySchema.safeParse({ status: 'BOGUS' })
    const issue = firstIssue(result)

    expect(issue.message).toBe('Status inválido')
    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
  })

  it('rejects a non-numeric page without leaking the coercion internals', () => {
    const result = listRequestsQuerySchema.safeParse({ page: 'abc' })
    const issue = firstIssue(result)

    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
    expect(issue.message).not.toMatch(/nan/i)
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

  it('rejects a decision outside the enum with a Portuguese message', () => {
    const result = decisionSchema.safeParse({ decision: 'MAYBE' })
    const issue = firstIssue(result)

    expect(issue.message).toBe('Decisão inválida')
    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
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

describe('loginSchema', () => {
  it('rejects a missing email', () => {
    const result = loginSchema.safeParse({ password: 'segredo123' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['email'])
    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
  })

  it('rejects a missing password', () => {
    const result = loginSchema.safeParse({ email: 'financeiro@empresa.com' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['password'])
    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
  })

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'não-é-email', password: 'segredo123' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['email'])
    expect(issue.message).toBe('E-mail inválido')
  })

  it('accepts a valid login payload', () => {
    expect(() =>
      loginSchema.parse({ email: 'financeiro@empresa.com', password: 'segredo123' }),
    ).not.toThrow()
  })
})

describe('localized error messages', () => {
  it('never leaks an English default message on any schema in this file', () => {
    const brokenPayloads: { name: string; schema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }; input: unknown }[] = [
      { name: 'createRequestSchema', schema: createRequestSchema, input: {} },
      { name: 'listRequestsQuerySchema', schema: listRequestsQuerySchema, input: { page: 'abc', status: 'BOGUS' } },
      { name: 'decisionSchema', schema: decisionSchema, input: { decision: 'MAYBE' } },
      { name: 'markPaidSchema', schema: markPaidSchema, input: {} },
      { name: 'loginSchema', schema: loginSchema, input: {} },
    ]

    for (const { name, schema, input } of brokenPayloads) {
      const result = schema.safeParse(input)
      expect(result.success, `${name} unexpectedly accepted a broken payload`).toBe(false)

      for (const issue of result.error!.issues) {
        expect(issue.message, `${name}: "${issue.message}"`).not.toMatch(ENGLISH_DEFAULT)
      }
    }
  })
})
