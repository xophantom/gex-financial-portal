import { randomUUID } from 'node:crypto'
import { loginSchema, type AuthResponse, type ErrorEnvelope } from '@gex/shared'
import { NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/api/base-url'
import { parseBody, upstreamUnavailable } from '@/lib/api/bff'
import { sealSession } from '@/lib/session/server'

// Este handler é a única peça do BFF que aceita e-mail/senha em texto puro.
// Ele nunca devolve access_token/refresh_token ao browser: sealSession grava
// os dois em cookies httpOnly antes de a resposta sair, então mesmo um XSS
// no bundle não consegue ler o token — só o objeto `user` cruza a fronteira.
export async function POST(request: Request) {
  const body = await parseBody(request, loginSchema)
  if (!body.ok) return body.response

  // Sem repassar o IP de quem chamou, a API veria o deste container em todo
  // login, e o limite por IP valeria para todos os usuários de uma vez. O Next
  // preenche x-forwarded-for com o endereço do socket; atrás de um proxy, o
  // último item da lista é o que o proxy mais próximo anexou.
  const clientIp = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
        ...(clientIp && { 'x-forwarded-for': clientIp }),
      },
      body: JSON.stringify(body.data),
      cache: 'no-store',
    })
  } catch {
    return upstreamUnavailable()
  }

  if (!upstream.ok) {
    const error: ErrorEnvelope | null = await upstream.json().catch(() => null)

    return NextResponse.json<ErrorEnvelope>(
      error ?? { error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado' } },
      { status: upstream.status },
    )
  }

  const auth = (await upstream.json()) as AuthResponse

  await sealSession({ access_token: auth.access_token, refresh_token: auth.refresh_token })

  return NextResponse.json({ user: auth.user })
}
