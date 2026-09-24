// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { decisionSchema } from '@gex/shared'
import { ApiError } from './client'
import { errorResponse, parseBody } from './bff'

const schema = decisionSchema

function jsonRequest(body: string) {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('parseBody', () => {
  it('returns the parsed data when the body matches the schema', async () => {
    const result = await parseBody(
      jsonRequest(JSON.stringify({ decision: 'REJECT', reason: '  duplicada ' })),
      schema,
    )

    expect(result).toEqual({ ok: true, data: { decision: 'REJECT', reason: 'duplicada' } })
  })

  it('answers 422 with field details when the body is invalid', async () => {
    const result = await parseBody(jsonRequest(JSON.stringify({ decision: 'REJECT' })), schema)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.response.status).toBe(422)
    expect(await result.response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: [{ field: 'reason', message: 'Informe o motivo da rejeição' }],
      },
    })
  })

  it('answers 422 for malformed JSON instead of throwing', async () => {
    const result = await parseBody(jsonRequest('{nao-e-json'), schema)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(422)
  })
})

describe('errorResponse', () => {
  it('forwards the status and envelope of an API error', async () => {
    const response = errorResponse(new ApiError(409, 'INVALID_TRANSITION', 'Transição inválida'))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_TRANSITION', message: 'Transição inválida' },
    })
  })

  // Sem os details, um erro de campo da API (ex.: data de pagamento) viraria
  // uma mensagem solta, longe do campo.
  it('keeps the field details of an API validation error', async () => {
    const details = [
      { field: 'paid_at', message: 'A data de pagamento não pode ser posterior a hoje' },
    ]
    const response = errorResponse(
      new ApiError(422, 'VALIDATION_ERROR', details[0].message, details),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).error.details).toEqual(details)
  })

  it('maps anything else to 502 UPSTREAM_UNAVAILABLE', async () => {
    const response = errorResponse(new TypeError('fetch failed'))

    expect(response.status).toBe(502)
    expect((await response.json()).error.code).toBe('UPSTREAM_UNAVAILABLE')
  })
})
