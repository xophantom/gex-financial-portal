import type { AuthResponse } from '@gex/shared'

// Nomes e opções dos cookies da sessão. Não depende de next/headers: o
// proxy (guard.ts) grava via NextResponse, e server.ts via cookies() nos
// Route Handlers. Só os tokens: quem é o usuário vem da API (GET /auth/me).

export const ACCESS_COOKIE = 'gex_access'
export const REFRESH_COOKIE = 'gex_refresh'

export const SESSION_COOKIE_NAMES = [ACCESS_COOKIE, REFRESH_COOKIE] as const

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

export type TokenPair = Pick<AuthResponse, 'access_token' | 'refresh_token'>

export function sessionCookies(tokens: TokenPair): SessionCookie[] {
  return [
    { ...baseCookie, name: ACCESS_COOKIE, value: tokens.access_token, maxAge: ACCESS_MAX_AGE },
    { ...baseCookie, name: REFRESH_COOKIE, value: tokens.refresh_token, maxAge: REFRESH_MAX_AGE },
  ]
}
