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
// não prova nada sobre o app rodando. Estas três provam, via HTTP de
// verdade (guards registrados, decorator @Roles lido, filtro produzindo o
// envelope), que RolesGuard está de fato ligado numa rota @Roles('FINANCE')
// — se o wiring fosse removido silenciosamente, o segundo teste voltaria a
// passar por engano e o terceiro pegaria isso.
describe('role-based authorization on a running route', () => {
  it('lets a FINANCE user through a FINANCE-only route', async () => {
    const token = await app.tokenFor('financeiro@gex.test', 'GexFinance123!');

    await request(app.server)
      .get('/requests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('refuses a REQUESTER on a FINANCE-only route with 403', async () => {
    const token = await app.tokenFor(
      'solicitante@gex.test',
      'GexRequester123!',
    );

    const response = await request(app.server)
      .get('/requests')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const body = response.body as ErrorBody;
    expect(body.error.code).toBe('FORBIDDEN');
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
