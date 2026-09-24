import type { ErrorEnvelope } from '@gex/shared'
import { NextResponse } from 'next/server'
import { ApiError } from './client'

// Tipo estrutural em vez do ZodType: os schemas vêm de @gex/shared e o
// apps/web não depende do zod diretamente.
interface BodySchema<T> {
  safeParse(
    input: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }
}

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

// Valida o corpo antes de ir à API, devolvendo o mesmo envelope 422 que o
// backend usa. JSON malformado cai no mesmo caminho (vira null e falha no
// schema).
export async function parseBody<T>(
  request: Request,
  schema: BodySchema<T>,
): Promise<ParsedBody<T>> {
  const raw = await request.json().catch(() => null)
  const parsed = schema.safeParse(raw)

  if (parsed.success) return { ok: true, data: parsed.data }

  return {
    ok: false,
    response: NextResponse.json<ErrorEnvelope>(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    ),
  }
}

// fetch() rejeita — não devolve uma Response — quando a API está fora do ar.
// Sem este envelope, o browser receberia um 500 sem corpo JSON e o
// formulário quebraria tentando ler response.json().
export function upstreamUnavailable(): NextResponse {
  return NextResponse.json<ErrorEnvelope>(
    {
      error: {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Não foi possível conversar com o servidor. Tente novamente em instantes.',
      },
    },
    { status: 502 },
  )
}

// Repassa o erro da API com o mesmo status e envelope; qualquer outra falha
// é tratada como API indisponível.
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json<ErrorEnvelope>(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    )
  }

  return upstreamUnavailable()
}
