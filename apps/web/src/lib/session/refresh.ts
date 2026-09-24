import type { AuthResponse } from '@gex/shared'
import { API_BASE_URL } from '@/lib/api/base-url'

// Troca do refresh token por um par novo. Não depende de next/headers: roda
// tanto no proxy (guard.ts) quanto no BFF (lib/api/client.ts).

// Sem prazo, um refresh travado prenderia para sempre todas as chamadas da
// mesma sessão que aguardam em refreshOnce.
const REFRESH_TIMEOUT_MS = 5000

class RefreshFailedError extends Error {
  constructor() {
    super('Sessão expirada')
  }
}

// Uma promessa por sessão (a chave é o refresh token): o módulo é compartilhado
// por todos os usuários do worker, e uma trava global entregaria a quem
// perdesse a corrida o token de outra conta.
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

// Troca o refresh token por um par novo, coalescendo chamadas concorrentes
// da mesma sessão. Qualquer resposta 2xx conta como sucesso; todo o resto
// (4xx, 5xx, rede, timeout) rejeita.
export function refreshSession(refreshToken: string, correlationId: string): Promise<AuthResponse> {
  return refreshOnce(refreshToken, async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    })

    if (!response.ok) throw new RefreshFailedError()

    return (await response.json()) as AuthResponse
  })
}
