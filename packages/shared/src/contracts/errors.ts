export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_INVOICE',
  'INVALID_TRANSITION',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  // Emitido pelo BFF do web quando a API não responde.
  'UPSTREAM_UNAVAILABLE',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorDetail {
  field: string
  message: string
}

export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; details?: ErrorDetail[] }
}
