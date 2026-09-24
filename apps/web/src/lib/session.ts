import { cookies } from 'next/headers'

export interface TokenPair {
  access_token: string
  refresh_token: string
}

const ACCESS = 'gex_access'
const REFRESH = 'gex_refresh'

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export async function sealSession(tokens: TokenPair): Promise<void> {
  const store = await cookies()

  store.set(ACCESS, tokens.access_token, { ...baseCookie, maxAge: 60 * 15 })
  store.set(REFRESH, tokens.refresh_token, { ...baseCookie, maxAge: 60 * 60 * 24 * 7 })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()

  store.delete(ACCESS)
  store.delete(REFRESH)
}

export async function readTokens(): Promise<Partial<TokenPair>> {
  const store = await cookies()

  return {
    access_token: store.get(ACCESS)?.value,
    refresh_token: store.get(REFRESH)?.value,
  }
}

let pending: Promise<TokenPair> | null = null

export async function refreshOnce(refresh: () => Promise<TokenPair>): Promise<TokenPair> {
  // Coalescer é o ponto: duas requisições paralelas com o access token
  // recém-expirado disparariam dois refresh, e a rotação do segundo
  // invalidaria o token que a primeira acabou de receber.
  pending ??= refresh().finally(() => {
    pending = null
  })

  return pending
}

export function __resetRefreshState(): void {
  pending = null
}
