// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRefreshState } from '@/lib/session/refresh'
import { ApiError, apiFetch, apiFetchForPage } from './client'

const cookieStore = new Map<string, string>()
const cookies = vi.hoisted(() => ({ writable: true }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      // Mesmo comportamento do Next em Server Components: cookies somente leitura.
      if (!cookies.writable) throw new Error('Cookies can only be modified in a Server Action or Route Handler')
      cookieStore.set(name, value)
    },
    delete: (name: string) => cookieStore.delete(name),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

const renewed = {
  access_token: 'novo-access',
  refresh_token: 'novo-refresh',
  user: { id: 'u1', name: 'Ana', email: 'ana@gex.test', role: 'REQUESTER' },
}

beforeEach(() => {
  __resetRefreshState()
  cookieStore.clear()
  cookieStore.set('gex_access', 'expirado')
  cookieStore.set('gex_refresh', 'refresh-valido')
  cookies.writable = true
  vi.stubGlobal('fetch', vi.fn())
})

describe('apiFetch', () => {
  it('renews the session on 401 and persists the new cookies in a Route Handler', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json(renewed, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ ok: true }))

    await expect(apiFetch('/dashboard/summary')).resolves.toEqual({ ok: true })

    const retry = vi.mocked(fetch).mock.calls[2]
    expect(retry[1]?.headers).toMatchObject({ authorization: 'Bearer novo-access' })
    expect(cookieStore.get('gex_access')).toBe('novo-access')
  })

  it('still answers with the renewed token where cookies are read-only', async () => {
    cookies.writable = false
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json(renewed, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ ok: true }))

    await expect(apiFetch('/dashboard/summary')).resolves.toEqual({ ok: true })
    expect(cookieStore.get('gex_access')).toBe('expirado')
  })

  it('surfaces a 401 when the refresh is rejected', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))

    await expect(apiFetch('/dashboard/summary')).rejects.toMatchObject({ status: 401 })
  })
})

describe('apiFetchForPage', () => {
  it('sends the user to /login when the session cannot be renewed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))

    await expect(apiFetchForPage('/dashboard/summary')).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('lets any other API error reach the error boundary', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Falhou' } }, { status: 500 }),
    )

    await expect(apiFetchForPage('/dashboard/summary')).rejects.toBeInstanceOf(ApiError)
  })
})
