import { randomUUID } from 'node:crypto'
import { loginSchema } from '@gex/shared'
import { NextResponse } from 'next/server'
import { parseBody, upstreamUnavailable } from '@/lib/bff'
import { sealSession } from '@/lib/session'
import { API_BASE_URL } from '@/lib/session-tokens'

// Este handler é a única peça do BFF que aceita e-mail/senha em texto puro.
// Ele nunca devolve access_token/refresh_token ao browser: sealSession grava
// os dois em cookies httpOnly antes de a resposta sair, então mesmo um XSS
// no bundle não consegue ler o token — só o objeto `user` cruza a fronteira.
export async function POST(request: Request) {
  const body = await parseBody(request, loginSchema)
  if (!body.ok) return body.response

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
      },
      body: JSON.stringify(body.data),
      cache: 'no-store',
    })
  } catch {
    return upstreamUnavailable()
  }

  const payload = await upstream.json().catch(() => null)

  if (!upstream.ok) {
    return NextResponse.json(
      payload ?? { error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado' } },
      { status: upstream.status },
    )
  }

  await sealSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: payload.user,
  })

  return NextResponse.json({ user: payload.user })
}
