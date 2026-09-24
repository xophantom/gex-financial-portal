// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guardSession } from './guard'
import { __resetRefreshState } from './refresh'

const renewed = {
  access_token: 'novo-access',
  refresh_token: 'novo-refresh',
  user: { id: 'u1', name: 'Ana', email: 'ana@gex.test', role: 'REQUESTER' },
}

function navigation(cookie?: string) {
  return new NextRequest('http://localhost/dashboard', {
    headers: cookie ? { cookie } : {},
  })
}

beforeEach(() => {
  __resetRefreshState()
  vi.stubGlobal('fetch', vi.fn())
})

describe('guardSession', () => {
  it('lets the request through untouched when the access cookie is present', async () => {
    const response = await guardSession(navigation('gex_access=valido; gex_refresh=r'))

    expect(response.headers.get('location')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('redirects to /login when there is no session at all', async () => {
    const response = await guardSession(navigation())

    expect(response.headers.get('location')).toBe('http://localhost/login')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renews an expired access token and forwards it to the same navigation', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(renewed, { status: 200 }))

    const response = await guardSession(navigation('gex_refresh=antigo'))

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/refresh',
      expect.objectContaining({ body: JSON.stringify({ refresh_token: 'antigo' }) }),
    )
    expect(response.headers.get('location')).toBeNull()

    // Set-Cookie para o browser...
    expect(response.cookies.get('gex_access')).toMatchObject({
      value: 'novo-access',
      httpOnly: true,
      maxAge: 60 * 15,
    })
    expect(response.cookies.get('gex_refresh')?.value).toBe('novo-refresh')
    expect(response.cookies.get('gex_user')?.value).toBe(JSON.stringify(renewed.user))

    // ...e o cookie reescrito no request que segue para o Server Component.
    expect(response.headers.get('x-middleware-request-cookie')).toContain('gex_access=novo-access')
  })

  it('clears the session and redirects to /login when the refresh is rejected', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({}, { status: 401 }))

    const response = await guardSession(navigation('gex_refresh=expirado; gex_user=x'))

    expect(response.headers.get('location')).toBe('http://localhost/login')
    for (const name of ['gex_access', 'gex_refresh', 'gex_user']) {
      expect(response.cookies.get(name)).toMatchObject({ value: '', path: '/', expires: new Date(0) })
    }
  })

  it('treats an unreachable API like a failed refresh', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

    const response = await guardSession(navigation('gex_refresh=qualquer'))

    expect(response.headers.get('location')).toBe('http://localhost/login')
  })
})
