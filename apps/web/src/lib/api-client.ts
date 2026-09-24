import { randomUUID } from 'node:crypto'
import { readTokens, refreshOnce, sealSession, type AuthPayload } from './session'

const BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3001'

// Sem prazo, um /auth/refresh que trava (API caiu no meio da resposta, rede
// pendurada) nunca resolve nem rejeita: a promise fica presa para sempre no
// mapa de refreshOnce, e todo mundo que compartilha aquela chave (mesma
// sessão) espera indefinidamente. O AbortSignal força a rejeição, o
// finally() de refreshOnce libera a chave, e uma tentativa seguinte ainda
// pode suceder.
const REFRESH_TIMEOUT_MS = 5000

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { access_token, refresh_token } = await readTokens()
  // Um único id para a chamada inteira — incluindo o refresh e o retry —
  // para que web, API e banco fiquem sob o mesmo id de correlação de ponta a
  // ponta. (Quando refreshOnce coalesce duas requisições da MESMA sessão, só
  // o id de quem venceu a corrida chega à rede: já é uma única chamada HTTP,
  // então já é um único id fazendo sentido.)
  const correlationId = randomUUID()

  const call = (token?: string) =>
    fetch(`${BASE}${path}`, {
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
    // Chave por sessão: o próprio refresh token. Duas requisições da MESMA
    // sessão que expiram ao mesmo tempo compartilham a chave (coalescem, é o
    // ponto). Duas sessões DIFERENTES nunca compartilham chave — sem isto,
    // quem perde a corrida recebe o token de acesso de outra conta.
    const renewed = await refreshOnce<AuthPayload>(refresh_token, async () => {
      const result = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify({ refresh_token }),
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
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
