import { createRequestSchema } from '@gex/shared'
import { NextResponse } from 'next/server'
import { ApiError, apiFetch } from '@/lib/api-client'

// Mesmo padrão do BFF de login (app/api/auth/login/route.ts): o Client
// Component (request-form.tsx) não pode importar api-client.ts diretamente
// porque ele lê o cookie httpOnly via next/headers, algo que só existe no
// lado do servidor. Esta rota é a ponte.
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  const parsed = createRequestSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    )
  }

  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined

  try {
    const created = await apiFetch('/requests', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }

    // fetch() dentro de apiFetch rejeita (não devolve uma Response) quando a
    // API está fora do ar — mesmo achado do login route.ts. Sem isto, o
    // formulário quebraria tentando ler um corpo que não existe.
    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'Não foi possível conversar com o servidor. Tente novamente em instantes.',
        },
      },
      { status: 502 },
    )
  }
}
