// Parte da sessão que não depende de next/headers: nomes e opções dos
// cookies, e a chamada a /auth/refresh. O proxy.ts usa este módulo direto
// (lá os cookies vêm de NextRequest/NextResponse); session.ts o usa por
// trás de cookies() nos Route Handlers e Server Components.

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

export interface AuthPayload extends TokenPair {
  user: SessionUser
}

export const ACCESS_COOKIE = 'gex_access'
export const REFRESH_COOKIE = 'gex_refresh'
export const USER_COOKIE = 'gex_user'

export const SESSION_COOKIE_NAMES = [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE] as const

const ACCESS_MAX_AGE = 60 * 15
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
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

export function sessionCookies(payload: AuthPayload): SessionCookie[] {
  return [
    { ...baseCookie, name: ACCESS_COOKIE, value: payload.access_token, maxAge: ACCESS_MAX_AGE },
    { ...baseCookie, name: REFRESH_COOKIE, value: payload.refresh_token, maxAge: REFRESH_MAX_AGE },
    // Acompanha a validade do refresh token, não a do access token:
    // readSession() precisa continuar respondendo quem está logado mesmo logo
    // após o access token expirar e antes do próximo refresh renová-lo.
    { ...baseCookie, name: USER_COOKIE, value: JSON.stringify(payload.user), maxAge: REFRESH_MAX_AGE },
  ]
}

export const API_BASE_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001'

// Sem prazo, um /auth/refresh que trava (API caiu no meio da resposta, rede
// pendurada) nunca resolve nem rejeita: a promise fica presa para sempre no
// mapa de refreshOnce, e todo mundo que compartilha aquela chave (mesma
// sessão) espera indefinidamente. O AbortSignal força a rejeição, o
// finally() de refreshOnce libera a chave, e uma tentativa seguinte ainda
// pode suceder.
const REFRESH_TIMEOUT_MS = 5000

export class RefreshFailedError extends Error {
  constructor() {
    super('Sessão expirada')
  }
}

// Map, não uma única variável de módulo: um worker Node atende requisições de
// vários usuários ao mesmo tempo, sobre o mesmo módulo carregado uma vez só.
// Uma trava global coalesceria o refresh de um usuário com o de outro, e quem
// perdesse a corrida receberia o token de acesso de outra conta. A chave é o
// próprio refresh token: identifica a sessão de forma única, é o mesmo valor
// para chamadas concorrentes do mesmo usuário e nunca colide entre usuários.
const pendingRefreshes = new Map<string, Promise<unknown>>()

export async function refreshOnce<T>(key: string, refresh: () => Promise<T>): Promise<T> {
  const existing = pendingRefreshes.get(key) as Promise<T> | undefined
  if (existing) return existing

  const promise = refresh().finally(() => {
    pendingRefreshes.delete(key)
  })

  pendingRefreshes.set(key, promise)
  return promise
}

export function __resetRefreshState(): void {
  pendingRefreshes.clear()
}

// Troca o refresh token por um par novo, coalescendo chamadas concorrentes
// da mesma sessão. Qualquer resposta 2xx conta como sucesso; todo o resto
// (4xx, 5xx, rede, timeout) rejeita.
export function refreshSession(refreshToken: string, correlationId: string): Promise<AuthPayload> {
  return refreshOnce(refreshToken, async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    })

    if (!response.ok) throw new RefreshFailedError()

    return (await response.json()) as AuthPayload
  })
}
