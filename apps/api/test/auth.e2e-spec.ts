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

  it('accepts the email in any letter case', async () => {
    await request(app.server)
      .post('/auth/login')
      .send({ email: '  Solicitante@GEX.test ', password: 'GexRequester123!' })
      .expect(200);
  });

  it('refuses malformed JSON with 422 VALIDATION_ERROR', async () => {
    const response = await request(app.server)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "solicitante@gex.test",')
      .expect(422);

    const body = response.body as ErrorBody;
    expect(body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
    });
  });

  it('rejects a malformed email with 422', async () => {
    await request(app.server)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(422);
  });
});

describe('POST /auth/refresh', () => {
  it('issues a new token pair with 200', async () => {
    const login = await request(app.server)
      .post('/auth/login')
      .send({ email: 'financeiro@gex.test', password: 'GexFinance123!' });
    const { refresh_token: refreshToken } = login.body as TokenPairBody;

    const response = await request(app.server)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);

    const body = response.body as TokenPairBody;
    expect(body.access_token).toEqual(expect.any(String));
    expect(body.refresh_token).toEqual(expect.any(String));
  });

  it.each([{}, { refresh_token: 42 }, { refresh_token: '' }])(
    'refuses the body %j with 422',
    async (payload) => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .send(payload)
        .expect(422);

      const body = response.body as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    },
  );
});

describe('unknown routes', () => {
  it('answers 404 with a Portuguese message', async () => {
    const response = await request(app.server).get('/nao-existe').expect(404);

    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada' },
    });
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

// Guards provados contra o app rodando, não isolados.
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

// Com `secret: undefined`, o @nestjs/jwt usaria JWT_SECRET para os dois
// tokens; helpers.ts usa segredos distintos para provar a separação.
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
