import { cookies } from 'next/headers'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  sessionCookies,
  type TokenPair,
} from './cookies'

// Sessão lida e gravada via next/headers: só existe em Server Components,
// Route Handlers e Server Actions. O proxy usa guard.ts.

// Só funciona em Route Handlers e Server Actions: em Server Components,
// cookies() é somente leitura e set() lança.
export async function sealSession(tokens: TokenPair): Promise<void> {
  const store = await cookies()

  for (const { name, value, ...options } of sessionCookies(tokens)) store.set(name, value, options)
}

export async function clearSession(): Promise<void> {
  const store = await cookies()

  for (const name of SESSION_COOKIE_NAMES) store.delete(name)
}

// Uso interno do BFF (lib/api/client.ts): Bearer header e corpo do POST
// /auth/refresh precisam dos tokens crus. Quem é o usuário vem de
// getSessionUser() (lib/session/user.ts).
export async function readTokens(): Promise<Partial<TokenPair>> {
  const store = await cookies()

  return {
    access_token: store.get(ACCESS_COOKIE)?.value,
    refresh_token: store.get(REFRESH_COOKIE)?.value,
  }
}

export async function hasSessionCookies(): Promise<boolean> {
  const store = await cookies()

  return store.has(ACCESS_COOKIE) || store.has(REFRESH_COOKIE)
}
