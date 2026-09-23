export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_INVOICE',
  'INVALID_TRANSITION',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorDetail {
  field: string
  message: string
}

export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; details?: ErrorDetail[] }
}
