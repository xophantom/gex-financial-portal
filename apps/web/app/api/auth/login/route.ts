import { randomUUID } from 'node:crypto'
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

  let upstream: Response
  try {
    upstream = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    })
  } catch {
    // fetch() rejeita — não devolve uma Response — quando a API está fora do
    // ar (porta fechada, DNS falho, conexão recusada). Sem este catch, essa
    // rejeição escapava do handler como 500 do próprio Next: corpo vazio, sem
    // content-type. O formulário chamava response.json() sobre ele e estourava
    // um SyntaxError dentro do submit — o usuário não via mensagem nenhuma.
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

  const body = await upstream.json().catch(() => null)

  if (!upstream.ok) {
    return NextResponse.json(
      body ?? { error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado' } },
      { status: upstream.status },
    )
  }

  await sealSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    user: body.user,
  })

  return NextResponse.json({ user: body.user })
}
