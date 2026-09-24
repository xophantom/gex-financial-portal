import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { readTokens, sealSession } from './session'
import { API_BASE_URL, refreshSession, type AuthPayload } from './session-tokens'

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { access_token, refresh_token } = await readTokens()
  // Um único id para a chamada inteira — incluindo o refresh e o retry —
  // para que web, API e banco fiquem sob o mesmo id de correlação de ponta a
  // ponta.
  const correlationId = randomUUID()

  const call = (token?: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        ...(token && { authorization: `Bearer ${token}` }),
        ...init.headers,
      },
      cache: 'no-store',
    })

  let response = await call(access_token)

  if (response.status === 401 && refresh_token) {
    const renewed = await refreshSession(refresh_token, correlationId).catch(() => null)

    if (renewed) {
      await persistRenewedSession(renewed)
      response = await call(renewed.access_token)
    }
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

// Para Server Components: uma sessão que nem o refresh salvou leva ao login,
// em vez de cair no error boundary.
export async function apiFetchForPage<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
    throw error
  }
}

async function persistRenewedSession(renewed: AuthPayload) {
  try {
    await sealSession(renewed)
  } catch {
    // Server Components não podem gravar cookies. O token novo ainda vale
    // para esta renderização, e o proxy renova os cookies na próxima
    // navegação.
  }
}
