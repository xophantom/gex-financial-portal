import { NextResponse, type NextRequest } from 'next/server'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  refreshSession,
  sessionCookies,
} from './session-tokens'

// Lógica do proxy.ts, separada para ser testável. O access token dura 15 min
// e o refresh token 7 dias: sem renovar aqui, toda navegação depois de 15 min
// parados cairia no login, e o refresh token nunca seria usado.
export async function guardSession(request: NextRequest): Promise<NextResponse> {
  if (request.cookies.has(ACCESS_COOKIE)) return NextResponse.next()

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (!refreshToken) return redirectToLogin(request)

  try {
    const renewed = await refreshSession(refreshToken, crypto.randomUUID())
    const cookies = sessionCookies(renewed)

    // Grava também no request encaminhado: o Server Component desta mesma
    // navegação lê os cookies do request, não os Set-Cookie da resposta.
    for (const { name, value } of cookies) request.cookies.set(name, value)

    const response = NextResponse.next({ request: { headers: request.headers } })
    for (const { name, value, ...options } of cookies) response.cookies.set(name, value, options)

    return response
  } catch {
    const response = redirectToLogin(request)
    for (const name of SESSION_COOKIE_NAMES) response.cookies.delete(name)

    return response
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/login', request.url))
}
