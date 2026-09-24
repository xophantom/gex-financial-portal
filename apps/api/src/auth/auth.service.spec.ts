import argon2 from 'argon2'
import { AuthService } from './auth.service'
import { AppException } from '../common/errors/app.exception'

const IP = '203.0.113.10'
// Espelha a constante privada de auth.service.ts só para o teste de limite
// por IP saber quantas tentativas fazer antes da que deve estourar — se as
// constantes divergirem, é o próprio arquivo fonte que muda, não este valor.
const MAX_ATTEMPTS_PER_IP = 30

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Ana',
  email: 'solicitante@gex.test',
  role: 'REQUESTER' as const,
  passwordHash: '',
}

/* eslint-disable @typescript-eslint/require-await -- os stubs devolvem Promise,
   como os métodos reais de JwtService, PrismaService e RedisService. */
const jwt = { signAsync: jest.fn(async () => 'token'), verifyAsync: jest.fn() }

// Contador em memória, não um mock fixo: os testes de reset e de limite por
// IP dependem de incrWithTtl acumular por chave e de delKey zerar só a sua.
function createFakeRedis() {
  const counts = new Map<string, number>()
  return {
    // Mesma assinatura do real (key, ttlSeconds); o fake não expira nada.
    incrWithTtl: jest.fn<Promise<number | null>, [string, number]>(async (key) => {
      const next = (counts.get(key) ?? 0) + 1
      counts.set(key, next)
      return next
    }),
    delKey: jest.fn(async (key: string) => {
      counts.delete(key)
    }),
  }
}
let redis: ReturnType<typeof createFakeRedis>

beforeEach(() => {
  redis = createFakeRedis()
})

const build = (found: typeof user | null) =>
  new AuthService(
    { user: { findUnique: jest.fn(async () => found) } } as never,
    jwt as never,
    redis as never,
  )
/* eslint-enable @typescript-eslint/require-await */

// Devolve o AppException tipado; se a promise resolver, falha nomeando o valor.
async function captureRejection(promise: Promise<unknown>): Promise<AppException> {
  let result: unknown
  try {
    result = await promise
  } catch (error) {
    if (error instanceof AppException) return error
    throw error
  }
  throw new Error(`expected the promise to reject, but it resolved with: ${JSON.stringify(result)}`)
}

beforeAll(async () => {
  // AuthService exige JWT_REFRESH_SECRET na construção.
  process.env.JWT_REFRESH_SECRET = 'auth-service-spec-refresh-secret'
  user.passwordHash = await argon2.hash('GexRequester123!', {
    type: argon2.argon2id,
  })
})

describe('AuthService construction', () => {
  // Um fallback aqui colapsaria access e refresh token na mesma chave.
  it('refuses to construct without JWT_REFRESH_SECRET', () => {
    const saved = process.env.JWT_REFRESH_SECRET
    delete process.env.JWT_REFRESH_SECRET

    try {
      expect(() => build(user)).toThrow(/JWT_REFRESH_SECRET/)
    } finally {
      process.env.JWT_REFRESH_SECRET = saved
    }
  })
})

describe('AuthService.login', () => {
  it('issues a token pair for valid credentials', async () => {
    const result = await build(user).login('solicitante@gex.test', 'GexRequester123!', IP)

    expect(result.access_token).toBe('token')
    expect(result.user).toMatchObject({ id: user.id, role: 'REQUESTER' })
  })

  it('never returns the password hash', async () => {
    const result = await build(user).login('solicitante@gex.test', 'GexRequester123!', IP)
    expect(JSON.stringify(result)).not.toContain('$argon2')
  })

  it('gives the same error for unknown email and wrong password', async () => {
    const unknown = await captureRejection(build(null).login('nobody@gex.test', 'x', IP))
    const wrong = await captureRejection(build(user).login('solicitante@gex.test', 'wrong', IP))

    expect(unknown).toBeInstanceOf(AppException)
    expect(unknown.message).toBe(wrong.message)
    expect(unknown.status).toBe(401)
  })

  it('refuses once the rate limit is exceeded', async () => {
    redis.incrWithTtl.mockResolvedValueOnce(11)

    await expect(
      build(user).login('solicitante@gex.test', 'GexRequester123!', IP),
    ).rejects.toMatchObject({ status: 429 })
  })
})

describe('AuthService.login timing', () => {
  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }

  // Sem o verify contra o hash fictício, a diferença é de ~12x. Mediana de
  // várias amostras para não oscilar com a CPU.
  it('takes a comparable amount of time for an unknown email and a wrong password', async () => {
    const SAMPLES = 7
    const knownTimes: number[] = []
    const unknownTimes: number[] = []

    for (let i = 0; i < SAMPLES; i++) {
      const knownStart = process.hrtime.bigint()
      await build(user)
        .login('solicitante@gex.test', 'wrong-password', IP)
        .catch(() => undefined)
      knownTimes.push(Number(process.hrtime.bigint() - knownStart))

      const unknownStart = process.hrtime.bigint()
      await build(null)
        .login('nobody@gex.test', 'wrong-password', IP)
        .catch(() => undefined)
      unknownTimes.push(Number(process.hrtime.bigint() - unknownStart))
    }

    const knownMedian = median(knownTimes)
    const unknownMedian = median(unknownTimes)
    const ratio = Math.max(knownMedian, unknownMedian) / Math.min(knownMedian, unknownMedian)

    expect(ratio).toBeLessThan(2.5)
  })
})

describe('AuthService rate limiting', () => {
  it('resets the per-email counter after a successful login, so failures right after are still reachable', async () => {
    const svc = build(user)

    for (let i = 0; i < 9; i++) {
      await expect(svc.login('solicitante@gex.test', 'wrong', IP)).rejects.toMatchObject({
        status: 401,
      })
    }

    await svc.login('solicitante@gex.test', 'GexRequester123!', IP)

    for (let i = 0; i < 9; i++) {
      await expect(svc.login('solicitante@gex.test', 'wrong', IP)).rejects.toMatchObject({
        status: 401,
      })
    }
  })

  it('throttles credential stuffing across many distinct e-mails from one IP', async () => {
    const svc = build(null)

    for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i++) {
      await expect(svc.login(`nobody-${i}@gex.test`, 'wrong', IP)).rejects.toMatchObject({
        status: 401,
      })
    }

    await expect(svc.login('one-more@gex.test', 'wrong', IP)).rejects.toMatchObject({ status: 429 })
  })

  // Um escritório atrás do mesmo NAT não pode se bloquear com logins válidos.
  it('does not count a successful login against the per-IP limit', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_IP - 1; i++) {
      await expect(build(null).login(`nobody-${i}@gex.test`, 'wrong', IP)).rejects.toMatchObject({
        status: 401,
      })
    }

    // Sucesso: não deve tocar o contador por IP.
    await build(user).login('solicitante@gex.test', 'GexRequester123!', IP)

    // Se o sucesso acima tivesse incrementado o contador, esta seria a
    // tentativa 31 e devolveria 429 em vez de 401.
    await expect(build(user).login('solicitante@gex.test', 'wrong', IP)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('deletes only its own key on success, leaving unrelated rate-limit keys untouched', async () => {
    await redis.incrWithTtl('login:email:outro.solicitante@gex.test', 300)

    await build(user).login('solicitante@gex.test', 'GexRequester123!', IP)

    expect(await redis.incrWithTtl('login:email:solicitante@gex.test', 300)).toBe(1)
    expect(await redis.incrWithTtl('login:email:outro.solicitante@gex.test', 300)).toBe(2)
  })
})

describe('AuthService with Redis unavailable', () => {
  // incrWithTtl devolve null quando o Redis não responde: fail-open.
  it('still logs in without a rate-limit count', async () => {
    redis.incrWithTtl.mockResolvedValue(null)

    const result = await build(user).login('solicitante@gex.test', 'GexRequester123!', IP)

    expect(result.access_token).toBe('token')
  })

  it('still answers 401, not 429, for a wrong password', async () => {
    redis.incrWithTtl.mockResolvedValue(null)

    await expect(build(user).login('solicitante@gex.test', 'wrong', IP)).rejects.toMatchObject({
      status: 401,
    })
  })
})
