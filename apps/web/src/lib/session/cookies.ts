import type { AuthResponse } from '@gex/shared'

// Nomes e opções dos cookies da sessão. Não depende de next/headers: o
// proxy (guard.ts) grava via NextResponse, e server.ts via cookies() nos
// Route Handlers.

export const ACCESS_COOKIE = 'gex_access'
export const REFRESH_COOKIE = 'gex_refresh'
export const USER_COOKIE = 'gex_user'

export const SESSION_COOKIE_NAMES = [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE] as const

const ACCESS_MAX_AGE = 60 * 15
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

// Secure por padrão em produção. O Compose local serve HTTP puro e desliga com
// COOKIE_SECURE=false: fora de um contexto seguro (IP da rede, Safari em
// localhost), o navegador descarta o cookie Secure e o login não se sustenta.
const secure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production'

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure,
  path: '/',
}

export interface SessionCookie {
  name: string
  value: string
  httpOnly: boolean
  sameSite: 'lax'
  secure: boolean
  path: string
  maxAge: number
}

export function sessionCookies(auth: AuthResponse): SessionCookie[] {
  return [
    { ...baseCookie, name: ACCESS_COOKIE, value: auth.access_token, maxAge: ACCESS_MAX_AGE },
    { ...baseCookie, name: REFRESH_COOKIE, value: auth.refresh_token, maxAge: REFRESH_MAX_AGE },
    // Acompanha a validade do refresh token, não a do access token:
    // readSession() precisa continuar respondendo quem está logado mesmo logo
    // após o access token expirar e antes do próximo refresh renová-lo.
    { ...baseCookie, name: USER_COOKIE, value: JSON.stringify(auth.user), maxAge: REFRESH_MAX_AGE },
  ]
}
