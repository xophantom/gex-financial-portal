import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Observable, map } from 'rxjs'

function convert(value: unknown): unknown {
  if (typeof value === 'bigint') {
    // Estourar em silêncio seria pior: um valor truncado vira dinheiro errado
    // que ninguém percebe, enquanto a exceção aparece no primeiro teste.
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Value ${value} exceeds the safe integer range`)
    }
    return Number(value)
  }

  if (Array.isArray(value)) return value.map(convert)

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, convert(item)]),
    )
  }

  return value
}

export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(convert))
  }
}
