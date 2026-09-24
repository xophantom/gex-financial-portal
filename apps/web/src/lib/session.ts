import { cookies } from 'next/headers'

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

const ACCESS = 'gex_access'
const REFRESH = 'gex_refresh'
const USER = 'gex_user'

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export async function sealSession(payload: AuthPayload): Promise<void> {
  const store = await cookies()

  store.set(ACCESS, payload.access_token, { ...baseCookie, maxAge: 60 * 15 })
  store.set(REFRESH, payload.refresh_token, { ...baseCookie, maxAge: 60 * 60 * 24 * 7 })
  // Acompanha a validade do refresh token, não a do access token: readSession()
  // precisa continuar respondendo quem está logado mesmo logo após o access
  // token expirar e antes do próximo refresh renová-lo.
  store.set(USER, JSON.stringify(payload.user), { ...baseCookie, maxAge: 60 * 60 * 24 * 7 })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()

  store.delete(ACCESS)
  store.delete(REFRESH)
  store.delete(USER)
}

// Uso interno do BFF (api-client.ts): Bearer header e corpo do POST
// /auth/refresh precisam dos tokens crus, não do usuário. Server Components
// não devem chamar isto — devem chamar readSession().
export async function readTokens(): Promise<Partial<TokenPair>> {
  const store = await cookies()

  return {
    access_token: store.get(ACCESS)?.value,
    refresh_token: store.get(REFRESH)?.value,
  }
}

// Contrato do brief (Task 17): é isto que os Server Components leem. Nunca
// devolve um objeto pela metade — falta o access token OU o usuário, o
// resultado é null, não um valor com campos ausentes.
export async function readSession(): Promise<{ accessToken: string; user: SessionUser } | null> {
  const store = await cookies()
  const accessToken = store.get(ACCESS)?.value
  const rawUser = store.get(USER)?.value

  if (!accessToken || !rawUser) return null

  try {
    return { accessToken, user: JSON.parse(rawUser) as SessionUser }
  } catch {
    return null
  }
}

// Map, não uma única variável de módulo: um worker Node atende requisições de
// VÁRIOS usuários ao mesmo tempo, sobre o mesmo módulo carregado uma vez só.
// Uma trava global coalescia o refresh de qualquer usuário com o de outro —
// quem perdia a corrida recebia o token de acesso de outra conta (sequestro
// de sessão, achado crítico da rodada de revisão). A chave é o próprio
// refresh token: ele já identifica a sessão de forma única, é o mesmo valor
// para chamadas concorrentes DO MESMO usuário (preservando a coalescência
// que existe para evitar a corrida de rotação dentro de uma sessão) e nunca
// colide entre usuários diferentes. O cast em `get` é seguro porque cada
// chave só é produzida — e portanto só é lida de volta — pelo mesmo call
// site, que sempre usa o mesmo formato de retorno para aquela chave.
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
