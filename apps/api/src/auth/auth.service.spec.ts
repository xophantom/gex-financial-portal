import argon2 from 'argon2';
import { AuthService } from './auth.service';
import { AppException } from '../common/http-exception.filter';

const IP = '203.0.113.10';
// Espelha a constante privada de auth.service.ts só para o teste de limite
// por IP saber quantas tentativas fazer antes da que deve estourar — se as
// constantes divergirem, é o próprio arquivo fonte que muda, não este valor.
const MAX_ATTEMPTS_PER_IP = 30;

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
/* eslint-enable @typescript-eslint/require-await */

// Fake de verdade (contador em memória), não um mock que sempre devolve o
// mesmo valor: os testes de reset e de limite por IP precisam que
// incrWithTtl acumule por chave e que del zere — sem isso não haveria como
// provar "nove falhas, um sucesso, nove falhas de novo, todas alcançáveis"
// nem "trinta e-mails diferentes do mesmo IP acabam em 429".
// delKey aqui é um Map.delete exato — o mesmo contrato do delKey real
// (client.del(key) direto). Isto já era verdade sem querer antes (quando o
// call site chamava `del`, mas o real `del` era por glob via KEYS): o fake
// não refletia o real, e esse desalinhamento escondeu o bug do KEYS. Agora
// que o call site usa delKey de verdade, os dois lados usam a mesma
// semântica de chave exata — não há mais o que divergir.
/* eslint-disable @typescript-eslint/require-await -- assíncronas para que o
   valor de retorno continue compatível com mockResolvedValueOnce, usado
   abaixo por um teste já existente. */
function createFakeRedis() {
  const counts = new Map<string, number>();
  return {
    // Precisa aceitar o segundo argumento (ttlSeconds) para bater com a
    // assinatura real de incrWithTtl(key, ttlSeconds); o fake não expira nada
    // de verdade, daí o eslint-disable na própria linha.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    incrWithTtl: jest.fn(async (key: string, ttlSeconds: number) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    delKey: jest.fn(async (key: string) => {
      counts.delete(key);
    }),
  };
}
/* eslint-enable @typescript-eslint/require-await */

let redis: ReturnType<typeof createFakeRedis>;

beforeEach(() => {
  redis = createFakeRedis();
});

const build = (found: typeof user | null) =>
  new AuthService(
    // eslint-disable-next-line @typescript-eslint/require-await
    { user: { findUnique: jest.fn(async () => found) } } as never,
    jwt as never,
    redis as never,
  );

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
  // Task 10 lesson, applied to config instead of wiring: a guard que existe
  // mas é silenciosamente contornável não protege nada. Sem este teste,
  // remover a checagem (ou reintroduzir um fallback) devolveria a suíte
  // inteira ao verde, porque nenhum outro teste aqui prova que a env var é
  // obrigatória.
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
      IP,
    );

    expect(result.access_token).toBe('token');
    expect(result.user).toMatchObject({ id: user.id, role: 'REQUESTER' });
  });

  it('never returns the password hash', async () => {
    const result = await build(user).login(
      'solicitante@gex.test',
      'GexRequester123!',
      IP,
    );
    expect(JSON.stringify(result)).not.toContain('$argon2');
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const unknown = await captureRejection(
      build(null).login('nobody@gex.test', 'x', IP),
    );
    const wrong = await captureRejection(
      build(user).login('solicitante@gex.test', 'wrong', IP),
    );

    expect(unknown).toBeInstanceOf(AppException);
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.status).toBe(401);
  });

  it('refuses once the rate limit is exceeded', async () => {
    redis.incrWithTtl.mockResolvedValueOnce(11);

    await expect(
      build(user).login('solicitante@gex.test', 'GexRequester123!', IP),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe('AuthService.login timing', () => {
  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  // Mede contra o binário real: e-mail inexistente (3.6ms) vs conta existente
  // com senha errada (43.5ms) — 12x de diferença porque argon2.verify só roda
  // no segundo caso. Vários samples + mediana, não uma amostra só, para não
  // ficar flaky com uma variação pontual de CPU; ainda assim tem que
  // continuar falhando se o verify contra o hash fictício for removido —
  // verificado abaixo, revertendo a correção antes de aplicá-la.
  it('takes a comparable amount of time for an unknown email and a wrong password', async () => {
    const SAMPLES = 7;
    const knownTimes: number[] = [];
    const unknownTimes: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const knownStart = process.hrtime.bigint();
      await build(user)
        .login('solicitante@gex.test', 'wrong-password', IP)
        .catch(() => undefined);
      knownTimes.push(Number(process.hrtime.bigint() - knownStart));

      const unknownStart = process.hrtime.bigint();
      await build(null)
        .login('nobody@gex.test', 'wrong-password', IP)
        .catch(() => undefined);
      unknownTimes.push(Number(process.hrtime.bigint() - unknownStart));
    }

    const knownMedian = median(knownTimes);
    const unknownMedian = median(unknownTimes);
    const ratio =
      Math.max(knownMedian, unknownMedian) /
      Math.min(knownMedian, unknownMedian);

    expect(ratio).toBeLessThan(2.5);
  });
});

describe('AuthService rate limiting', () => {
  it('resets the per-email counter after a successful login, so failures right after are still reachable', async () => {
    const svc = build(user);

    for (let i = 0; i < 9; i++) {
      await expect(
        svc.login('solicitante@gex.test', 'wrong', IP),
      ).rejects.toMatchObject({ status: 401 });
    }

    await svc.login('solicitante@gex.test', 'GexRequester123!', IP);

    for (let i = 0; i < 9; i++) {
      await expect(
        svc.login('solicitante@gex.test', 'wrong', IP),
      ).rejects.toMatchObject({ status: 401 });
    }
  });

  it('throttles credential stuffing across many distinct e-mails from one IP', async () => {
    const svc = build(null);

    for (let i = 0; i < MAX_ATTEMPTS_PER_IP; i++) {
      await expect(
        svc.login(`nobody-${i}@gex.test`, 'wrong', IP),
      ).rejects.toMatchObject({ status: 401 });
    }

    await expect(
      svc.login('one-more@gex.test', 'wrong', IP),
    ).rejects.toMatchObject({ status: 429 });
  });

  // Fix round 3: o contador por IP só devia contar FALHA. Antes, um sucesso
  // também incrementava — um escritório inteiro atrás do mesmo NAT batendo
  // 30 logins bem-sucedidos numa manhã comum se autobaniria sem que ninguém
  // tivesse digitado uma senha errada.
  it('does not count a successful login against the per-IP limit', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_IP - 1; i++) {
      await expect(
        build(null).login(`nobody-${i}@gex.test`, 'wrong', IP),
      ).rejects.toMatchObject({ status: 401 });
    }

    // Sucesso: não deve tocar o contador por IP.
    await build(user).login('solicitante@gex.test', 'GexRequester123!', IP);

    // Se o sucesso acima tivesse incrementado o contador, esta seria a
    // tentativa 31 e devolveria 429 em vez de 401.
    await expect(
      build(user).login('solicitante@gex.test', 'wrong', IP),
    ).rejects.toMatchObject({ status: 401 });
  });

  // Fix round 3: del(pattern) via KEYS apagaria qualquer chave que desse
  // match no padrão, não só a do e-mail que logou — um delete por glob
  // barato de escrever e caro de descobrir em produção. delKey(key) só pode
  // afetar a própria chave; este teste é exatamente o que pegaria uma
  // regressão de volta para um delete por padrão.
  it('deletes only its own key on success, leaving unrelated rate-limit keys untouched', async () => {
    // Popula a chave alheia antes: login() vai incrementar e depois apagar a
    // sua própria chave (login:email:solicitante@gex.test) como parte do
    // próprio fluxo — o que importa aqui é o que sobra da OUTRA.
    await redis.incrWithTtl('login:email:outro.solicitante@gex.test', 300);

    await build(user).login('solicitante@gex.test', 'GexRequester123!', IP);

    // A própria chave foi apagada: o próximo incremento reinicia do zero.
    expect(
      await redis.incrWithTtl('login:email:solicitante@gex.test', 300),
    ).toBe(1);
    // A chave alheia sobreviveu: continua de onde estava (1 -> 2), não
    // reiniciou (o que aconteceria se ela tivesse sido apagada também).
    expect(
      await redis.incrWithTtl('login:email:outro.solicitante@gex.test', 300),
    ).toBe(2);
  });
});
