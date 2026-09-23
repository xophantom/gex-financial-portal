import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { ErrorEnvelope } from '@gex/shared'
import { ZodError, z } from 'zod'
import { AppException, HttpExceptionFilter } from './http-exception.filter'

const capture = (exception: unknown) => {
  const body: unknown[] = []
  const response = {
    status: jest.fn().mockReturnThis(),
    json: (payload: unknown) => body.push(payload),
  }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ url: '/x' }) }),
  }

  new HttpExceptionFilter().catch(exception, host as never)

  return { status: response.status.mock.calls[0][0], body: body[0] as ErrorEnvelope }
}

describe('HttpExceptionFilter', () => {
  it('renders an AppException with its code and status', () => {
    const { status, body } = capture(
      new AppException('DUPLICATE_INVOICE', 'Nota já cadastrada', 409),
    )

    expect(status).toBe(409)
    expect(body).toEqual({
      error: { code: 'DUPLICATE_INVOICE', message: 'Nota já cadastrada' },
    })
  })

  it('turns a ZodError into a 422 with per-field details', () => {
    const schema = z.object({ amount_cents: z.number().positive('Deve ser positivo') })
    let error!: ZodError

    try {
      schema.parse({ amount_cents: -1 })
    } catch (caught) {
      error = caught as ZodError
    }

    const { status, body } = capture(error)

    expect(status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([
      { field: 'amount_cents', message: 'Deve ser positivo' },
    ])
  })

  it('maps a Nest NotFoundException to NOT_FOUND', () => {
    expect(capture(new NotFoundException()).body.error.code).toBe('NOT_FOUND')
  })

  it('maps an unknown error to a 500 without leaking its message', () => {
    const { status, body } = capture(new Error('connection string user:password@host'))

    expect(status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(body)).not.toContain('password')
  })

  it('never includes a stack trace in the response', () => {
    const { body } = capture(new BadRequestException('bad'))
    expect(JSON.stringify(body)).not.toContain('at ')
  })
})
