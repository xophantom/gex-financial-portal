import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

// Exportada para o idempotency.service.ts reusar: o payload que ele grava no
// Redis é o mesmo objeto de resposta do service, com amount_cents ainda em
// BigInt (a conversão para Number só acontece aqui, no interceptor, depois
// que o controller devolve). JSON.stringify não serializa BigInt — sem
// converter antes de gravar, um replay de Idempotency-Key derruba a
// requisição com 500. Reaproveitar esta função, em vez de escrever uma
// segunda conversão, é o que garante que a resposta original e a repetida
// carreguem exatamente o mesmo número.
export function convert(value: unknown): unknown {
  if (typeof value === 'bigint') {
    // Estourar em silêncio seria pior: um valor truncado vira dinheiro errado
    // que ninguém percebe, enquanto a exceção aparece no primeiro teste. O
    // limite é simétrico porque nada garante que todo BigInt futuro venha de
    // uma coluna com constraint de positividade como amount_cents.
    if (
      value > BigInt(Number.MAX_SAFE_INTEGER) ||
      value < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error(`Value ${value} exceeds the safe integer range`);
    }
    return Number(value);
  }

  if (Array.isArray(value)) return value.map(convert);

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, convert(item)]),
    );
  }

  return value;
}

export class BigIntInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map(convert));
  }
}
