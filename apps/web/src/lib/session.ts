import { cookies } from 'next/headers'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  USER_COOKIE,
  sessionCookies,
  type AuthPayload,
  type SessionUser,
  type TokenPair,
} from './session-tokens'

export {
  __resetRefreshState,
  refreshOnce,
  type AuthPayload,
  type SessionUser,
  type TokenPair,
} from './session-tokens'

// Só funciona em Route Handlers e Server Actions: em Server Components,
// cookies() é somente leitura e set() lança.
export async function sealSession(payload: AuthPayload): Promise<void> {
  const store = await cookies()

  for (const { name, value, ...options } of sessionCookies(payload)) store.set(name, value, options)
}

export async function clearSession(): Promise<void> {
  const store = await cookies()

  for (const name of SESSION_COOKIE_NAMES) store.delete(name)
}

// Uso interno do BFF (api-client.ts): Bearer header e corpo do POST
// /auth/refresh precisam dos tokens crus, não do usuário. Server Components
// não devem chamar isto — devem chamar readSession().
export async function readTokens(): Promise<Partial<TokenPair>> {
  const store = await cookies()

  return {
    access_token: store.get(ACCESS_COOKIE)?.value,
    refresh_token: store.get(REFRESH_COOKIE)?.value,
  }
}

// É isto que os Server Components leem. Nunca devolve um objeto pela metade:
// faltando o access token ou o usuário, o resultado é null.
export async function readSession(): Promise<{ accessToken: string; user: SessionUser } | null> {
  const store = await cookies()
  const accessToken = store.get(ACCESS_COOKIE)?.value
  const rawUser = store.get(USER_COOKIE)?.value

  if (!accessToken || !rawUser) return null

  try {
    return { accessToken, user: JSON.parse(rawUser) as SessionUser }
  } catch {
    return null
  }
}
