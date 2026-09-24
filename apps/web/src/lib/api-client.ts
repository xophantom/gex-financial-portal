import { randomUUID } from 'node:crypto'
import { readTokens, refreshOnce, sealSession } from './session'

const BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { access_token, refresh_token } = await readTokens()

  const call = (token?: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
        ...(token && { authorization: `Bearer ${token}` }),
        ...init.headers,
      },
      cache: 'no-store',
    })

  let response = await call(access_token)

  if (response.status === 401 && refresh_token) {
    const renewed = await refreshOnce(async () => {
      const result = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      })

      if (!result.ok) throw new ApiError(401, 'UNAUTHENTICATED', 'Sessão expirada')

      return result.json()
    })

    await sealSession(renewed)
    response = await call(renewed.access_token)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'INTERNAL_ERROR',
      body?.error?.message ?? 'Erro inesperado',
    )
  }

  return response.json() as Promise<T>
}
