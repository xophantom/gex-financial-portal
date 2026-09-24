// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRefreshState } from './refresh'
import { findSessionUser } from './user'

const cookieStore = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    has: (name: string) => cookieStore.has(name),
    // Como num Server Component: cookies somente leitura.
    set: () => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler')
    },
    delete: (name: string) => cookieStore.delete(name),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

const user = { id: 'u1', name: 'Ana', email: 'ana@gex.test', role: 'REQUESTER' }

beforeEach(() => {
  __resetRefreshState()
  cookieStore.clear()
  vi.stubGlobal('fetch', vi.fn())
})

describe('findSessionUser', () => {
  it('does not call the API when there is no session cookie', async () => {
    await expect(findSessionUser()).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns the user the API vouches for', async () => {
    cookieStore.set('gex_access', 'valido')
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(user))

    await expect(findSessionUser()).resolves.toEqual(user)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://localhost:3001/auth/me')
  })

  // Redirecionar aqui faria login e visão geral se mandarem um para o outro.
  it('answers null, without redirecting, for a session the API no longer accepts', async () => {
    cookieStore.set('gex_access', 'expirado')
    cookieStore.set('gex_refresh', 'expirado')
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))

    await expect(findSessionUser()).resolves.toBeNull()
  })
})
