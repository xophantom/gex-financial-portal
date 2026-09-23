import argon2 from 'argon2';
import { AuthService } from './auth.service';
import { AppException } from '../common/http-exception.filter';

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Ana',
  email: 'solicitante@gex.test',
  role: 'REQUESTER' as const,
  passwordHash: '',
};

// async sem await de propósito: o stub só precisa devolver uma Promise, como
// os métodos reais de JwtService/PrismaService/RedisService fazem — sem isso,
// mockResolvedValueOnce (usado mais abaixo) não teria o que sobrescrever.
/* eslint-disable @typescript-eslint/require-await */
const jwt = { signAsync: jest.fn(async () => 'token'), verifyAsync: jest.fn() };
const redis = { incrWithTtl: jest.fn(async () => 1) };

const build = (found: typeof user | null) =>
  new AuthService(
    { user: { findUnique: jest.fn(async () => found) } } as never,
    jwt as never,
    redis as never,
  );
/* eslint-enable @typescript-eslint/require-await */

// Substitui o `.catch((e) => e)` do enunciado: aquele padrão só type-checa
// porque `noImplicitAny` está desligado neste projeto (o catch sem anotação
// vira `any`, que o ESLint recusa). Isto devolve o mesmo AppException, mas
// com tipo real — e, se a promise resolver em vez de rejeitar (o que não
// deveria acontecer nestes dois testes), lança nomeando o valor recebido em
// vez de devolvê-lo como se fosse um AppException.
async function captureRejection(
  promise: Promise<unknown>,
): Promise<AppException> {
  let result: unknown;
  try {
    result = await promise;
  } catch (error) {
    if (error instanceof AppException) return error;
    throw error;
  }
  throw new Error(
    `expected the promise to reject, but it resolved with: ${JSON.stringify(result)}`,
  );
}

beforeAll(async () => {
  // AuthService agora exige JWT_REFRESH_SECRET na construção (fix round 1:
  // sem fallback, para não colapsar access e refresh token na mesma chave
  // quando a env var falta). build() constrói um AuthService de verdade em
  // cada teste, então isto precisa estar setado antes do primeiro deles.
  process.env.JWT_REFRESH_SECRET = 'auth-service-spec-refresh-secret';
  user.passwordHash = await argon2.hash('GexRequester123!', {
    type: argon2.argon2id,
  });
});

describe('AuthService construction', () => {
  // Task 10 lesson, applied to config instead of wiring: a guard that exists
  // but is silently bypassable protects nothing. Sem este teste, remover a
  // checagem (ou reintroduzir um fallback) devolveria a suíte inteira ao
  // verde, porque nenhum outro teste aqui prova que a env var é obrigatória.
  it('refuses to construct without JWT_REFRESH_SECRET', () => {
    const saved = process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    try {
      expect(() => build(user)).toThrow(/JWT_REFRESH_SECRET/);
    } finally {
      process.env.JWT_REFRESH_SECRET = saved;
    }
  });
});

describe('AuthService.login', () => {
  it('issues a token pair for valid credentials', async () => {
    const result = await build(user).login(
      'solicitante@gex.test',
      'GexRequester123!',
    );

    expect(result.access_token).toBe('token');
    expect(result.user).toMatchObject({ id: user.id, role: 'REQUESTER' });
  });

  it('never returns the password hash', async () => {
    const result = await build(user).login(
      'solicitante@gex.test',
      'GexRequester123!',
    );
    expect(JSON.stringify(result)).not.toContain('$argon2');
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const unknown = await captureRejection(
      build(null).login('nobody@gex.test', 'x'),
    );
    const wrong = await captureRejection(
      build(user).login('solicitante@gex.test', 'wrong'),
    );

    expect(unknown).toBeInstanceOf(AppException);
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.status).toBe(401);
  });

  it('refuses once the rate limit is exceeded', async () => {
    redis.incrWithTtl.mockResolvedValueOnce(11);

    await expect(
      build(user).login('solicitante@gex.test', 'GexRequester123!'),
    ).rejects.toMatchObject({ status: 429 });
  });
});
