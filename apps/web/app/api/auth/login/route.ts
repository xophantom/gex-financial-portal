import { loginSchema } from '@gex/shared'
import { NextResponse } from 'next/server'
import { sealSession } from '@/lib/session'

const BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3001'

// Este handler é a única peça do BFF que aceita e-mail/senha em texto puro.
// Ele nunca devolve access_token/refresh_token ao browser: sealSession grava
// os dois em cookies httpOnly antes de a resposta sair, então mesmo um XSS
// no bundle não consegue ler o token — só o objeto `user` cruza a fronteira.
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(raw)

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

  const upstream = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  })

  const body = await upstream.json().catch(() => null)

  if (!upstream.ok) {
    return NextResponse.json(
      body ?? { error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado' } },
      { status: upstream.status },
    )
  }

  await sealSession({ access_token: body.access_token, refresh_token: body.refresh_token })

  return NextResponse.json({ user: body.user })
}
