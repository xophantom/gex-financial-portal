import type { SessionUser } from '@gex/shared'
import { cache } from 'react'
import { apiFetch, apiFetchForPage } from '@/lib/api/client'
import { hasSessionCookies } from './server'

// Quem está logado, perguntado à API: o papel exibido e os atalhos da tela
// seguem o mesmo usuário que a API autoriza. cache() faz layout e página
// dividirem uma única chamada por renderização. Sem sessão, leva ao login.
export const getSessionUser = cache((): Promise<SessionUser> =>
  apiFetchForPage<SessionUser>('/auth/me'),
)

// Para a tela de login: null em vez de redirecionar, porque uma sessão
// inválida mandando para o login não pode virar um laço com o próprio login.
export async function findSessionUser(): Promise<SessionUser | null> {
  if (!(await hasSessionCookies())) return null

  return apiFetch<SessionUser>('/auth/me').catch(() => null)
}
