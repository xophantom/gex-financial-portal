import type { AuthResponse } from '@gex/shared'
import { API_BASE_URL } from '@/lib/api/base-url'

// Troca do refresh token por um par novo. Não depende de next/headers: roda
// tanto no proxy (guard.ts) quanto no BFF (lib/api/client.ts).

// Sem prazo, um /auth/refresh que trava (API caiu no meio da resposta, rede
// pendurada) nunca resolve nem rejeita: a promise fica presa para sempre no
// mapa de refreshOnce, e todo mundo que compartilha aquela chave (mesma
// sessão) espera indefinidamente. O AbortSignal força a rejeição, o
// finally() de refreshOnce libera a chave, e uma tentativa seguinte ainda
// pode suceder.
const REFRESH_TIMEOUT_MS = 5000

export class RefreshFailedError extends Error {
  constructor() {
    super('Sessão expirada')
  }
}

// Map, não uma única variável de módulo: um worker Node atende requisições de
// vários usuários ao mesmo tempo, sobre o mesmo módulo carregado uma vez só.
// Uma trava global coalesceria o refresh de um usuário com o de outro, e quem
// perdesse a corrida receberia o token de acesso de outra conta. A chave é o
// próprio refresh token: identifica a sessão de forma única, é o mesmo valor
// para chamadas concorrentes do mesmo usuário e nunca colide entre usuários.
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
