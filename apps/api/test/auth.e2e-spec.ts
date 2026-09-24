import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers';

interface LoginBody {
  user: { role: string };
  access_token: string;
}

interface ErrorBody {
  error: { code: string; message: string };
}

interface TokenPairBody {
  access_token: string;
  refresh_token: string;
}

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);

afterAll(async () => app.close());

describe('POST /auth/login', () => {
  it('authenticates a seeded requester', async () => {
    const response = await request(app.server)
      .post('/auth/login')
      .send({ email: 'solicitante@gex.test', password: 'GexRequester123!' })
      .expect(200);

    const body = response.body as LoginBody;
    expect(body.user.role).toBe('REQUESTER');
    expect(body.access_token).toEqual(expect.any(String));
  });

  it('rejects a wrong password with 401 and no hint', async () => {
    const response = await request(app.server)
      .post('/auth/login')
      .send({ email: 'solicitante@gex.test', password: 'wrong' })
      .expect(401);

    const body = response.body as ErrorBody;
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toBe('E-mail ou senha inválidos');
  });

  it('never leaks the password hash in the response', async () => {
    const response = await request(app.server)
      .post('/auth/login')
      .send({ email: 'financeiro@gex.test', password: 'GexFinance123!' });

    expect(JSON.stringify(response.body)).not.toContain('$argon2');
  });

  it('rejects a malformed email with 422', async () => {
    await request(app.server)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(422);
  });
});

describe('protected routes', () => {
  it('refuses a request without a token', async () => {
    await request(app.server).get('/requests').expect(401);
  });

  it('refuses a request with a malformed token', async () => {
    await request(app.server)
      .get('/requests')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
  });
});

// A parte que Task 10 aprendeu do jeito difícil: um guard testado isolado
// não prova nada sobre o app rodando. Até a Tarefa 11, GET /requests era um
// stub @Roles('FINANCE') que existia só para provar RolesGuard via HTTP de
// verdade. A Tarefa 12 substituiu o stub pelo domínio real: a rota agora é
// de ambos os papéis (FINANCE vê tudo, REQUESTER só as próprias, filtrado no
// where() do repositório) — então "REQUESTER recebe 403" deixou de ser
// verdade aqui, e virou o teste de escopo abaixo. A prova de RolesGuard
// barrando por papel volta a ter onde acontecer na primeira rota
// genuinamente FINANCE-only (aprovar/rejeitar/marcar pago).
describe('authenticated access to a running route', () => {
  it('lets a FINANCE user through', async () => {
    const token = await app.tokenFor('financeiro@gex.test', 'GexFinance123!');

    await request(app.server)
      .get('/requests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('lets a REQUESTER through, scoped to their own requests', async () => {
    const token = await app.tokenFor(
      'solicitante@gex.test',
      'GexRequester123!',
    );

    await request(app.server)
      .get('/requests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('refuses a request signed with the wrong secret', async () => {
    const forged = new JwtService({ secret: 'not-the-real-secret' }).sign({
      sub: '10000000-0000-4000-8000-000000000001',
      role: 'FINANCE',
    });

    await request(app.server)
      .get('/requests')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });
});

// Fix round 1: @nestjs/jwt cai de volta para o secret padrão do módulo
// (JWT_SECRET) quando `secret` é `undefined` — verificado lendo
// jwt.service.js diretamente e reproduzido num script isolado. Isso
// colapsaria access e refresh token na mesma chave se JWT_REFRESH_SECRET
// nunca fosse validado. Estes dois testes provam, contra o app rodando de
// verdade (helpers.ts usa um JWT_SECRET e um JWT_REFRESH_SECRET distintos),
// que as duas chaves continuam genuinamente separadas.
describe('access and refresh tokens use distinct secrets', () => {
  it('rejects a refresh token used as an access token', async () => {
    const login = await request(app.server)
      .post('/auth/login')
      .send({ email: 'financeiro@gex.test', password: 'GexFinance123!' });

    const { refresh_token: refreshToken } = login.body as TokenPairBody;

    await request(app.server)
      .get('/requests')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401);
  });

  it('rejects an access token used as a refresh token', async () => {
    const login = await request(app.server)
      .post('/auth/login')
      .send({ email: 'financeiro@gex.test', password: 'GexFinance123!' });

    const { access_token: accessToken } = login.body as TokenPairBody;

    const response = await request(app.server)
      .post('/auth/refresh')
      .send({ refresh_token: accessToken })
      .expect(401);

    const body = response.body as ErrorBody;
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });
});
