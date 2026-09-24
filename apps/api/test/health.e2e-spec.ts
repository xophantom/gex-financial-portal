import request from 'supertest';
import { createTestApp, TestApp } from './support/test-app';

interface HealthBody {
  status: string;
  checks: { database: string; redis: string };
}

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);

afterAll(async () => app.close());

describe('GET /health', () => {
  it('reports ok when database and redis answer', async () => {
    const response = await request(app.server).get('/health').expect(200);
    const body = response.body as HealthBody;

    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('up');
    expect(body.checks.redis).toBe('up');
  });

  it('needs no authentication, so the container healthcheck can call it', async () => {
    await request(app.server).get('/health').expect(200);
  });

  it('reports degraded with 200 when only redis is down', async () => {
    // finally, não só a última linha do it(): se a asserção abaixo lançar,
    // um `await app.startRedis()` colocado depois dela simplesmente nunca
    // roda, e o Redis de teste fica pausado para os its seguintes (e para
    // o afterAll). O container tem que voltar independentemente do
    // resultado da asserção.
    await app.stopRedis();
    try {
      const response = await request(app.server).get('/health').expect(200);
      const body = response.body as HealthBody;

      expect(body.status).toBe('degraded');
      expect(body.checks.redis).toBe('down');
    } finally {
      await app.startRedis();
    }
  });

  it('reports unhealthy with 503 when the database is down', async () => {
    // Mesmo raciocínio do teste do Redis acima, e mais crítico aqui: sem o
    // finally, uma asserção que falha deixa o Postgres de teste pausado, e
    // o afterAll (app.close() → PrismaService.onModuleDestroy →
    // $disconnect()) trava contra um socket congelado que nunca responde
    // nem rejeita — foi exatamente isto que aconteceu de verdade durante
    // este trabalho (duas vezes), exigindo `docker unpause`/`stop`/`rm`
    // manual para destravar o Jest.
    await app.stopDatabase();
    try {
      const response = await request(app.server).get('/health').expect(503);
      const body = response.body as HealthBody;

      expect(body.status).toBe('unhealthy');
    } finally {
      await app.startDatabase();
    }
  });
});

describe('GET /docs', () => {
  it('serves the generated API documentation', async () => {
    await request(app.server).get('/docs').expect(200);
  });
});
