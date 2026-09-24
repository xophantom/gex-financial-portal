import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const cookieStore = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: (name: string, value: string) => cookieStore.set(name, value),
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    delete: (name: string) => cookieStore.delete(name),
  }),
}))

function loginRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ email: 'solicitante@gex.test', password: 'GexRequester123!' }),
  })
}

beforeEach(() => {
  cookieStore.clear()
  vi.stubGlobal('fetch', vi.fn())
})

describe('POST /api/auth/login', () => {
  it('never lets a token reach the response body — that is the entire point of the BFF', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'eyJhbGciOiJIUzI1NiJ9.payload-de-acesso.assinatura',
        refresh_token: 'eyJhbGciOiJIUzI1NiJ9.payload-de-refresh.assinatura',
        user: {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Ana Solicitante',
          email: 'solicitante@gex.test',
          role: 'REQUESTER',
        },
      }),
    } as Response)

    const response = await POST(loginRequest())
    const text = await response.text()

    expect(text).not.toContain('access_token')
    expect(text).not.toContain('refresh_token')
    expect(text).not.toContain('eyJ')
    expect(JSON.parse(text)).toEqual({
      user: {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Ana Solicitante',
        email: 'solicitante@gex.test',
        role: 'REQUESTER',
      },
    })

    // As duas metades da sessão foram seladas no cookie, não no corpo.
    expect(cookieStore.get('gex_access')).toContain('eyJ')
    expect(cookieStore.get('gex_refresh')).toContain('eyJ')
  })

  // O limite de tentativas por IP da API depende disto: sem o repasse, todo
  // login chegaria com o IP do container web.
  it("forwards the caller's IP, taking the entry appended by the closest proxy", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHENTICATED', message: 'E-mail ou senha inválidos' },
      }),
    } as Response)

    await POST(loginRequest({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7' }))

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['x-forwarded-for']).toBe('203.0.113.7')
  })

  it('returns a JSON, Portuguese error envelope when the API is unreachable', async () => {
    // Porta fechada / conexão recusada faz
    // fetch() REJEITAR (não devolver uma Response). Sem tratar isso, essa
    // rejeição escapa do handler crua — o browser recebe um 500 sem corpo
    // JSON, e o formulário quebra tentando ler response.json().
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

    const response = await POST(loginRequest())

    expect(response.status).toBe(502)
    expect(response.headers.get('content-type')).toContain('application/json')

    const body = await response.json()
    expect(body.error.code).toBe('UPSTREAM_UNAVAILABLE')
    expect(body.error.message).toMatch(/servidor/i)
  })
})
