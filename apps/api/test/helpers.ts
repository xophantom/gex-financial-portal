import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { withTimeout } from '../src/common/with-timeout';
import { seed } from '../prisma/seed';
import {
  pauseTestDatabase,
  pauseTestRedis,
  startTestDatabase,
  startTestRedis,
  stopTestDatabase,
  stopTestRedis,
  unpauseTestDatabase,
  unpauseTestRedis,
} from './testcontainers';

export interface TestApp {
  server: Server;
  close(): Promise<void>;
  tokenFor(email: string, password: string): Promise<string>;
  stopDatabase(): Promise<void>;
  startDatabase(): Promise<void>;
  stopRedis(): Promise<void>;
  startRedis(): Promise<void>;
}

// Segredo fixo de propósito: o container de teste é descartável e recriado
// a cada suíte, então não existe "segredo de produção" a proteger aqui —
// só precisa ser estável o bastante para assinar e verificar dentro do
// mesmo processo de teste.
const TEST_JWT_SECRET = 'test-jwt-secret';
const TEST_JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
// Mesmo valor fixo do smoke test (scripts/smoke-test.ts): sem isto,
// ClockService cai para a data real do relógio (Global module, instanciado
// eagerly no compile()), e qualquer asserção de "vencido" no seed vira uma
// bomba-relógio que só falha no dia em que a data real ultrapassa os
// vencimentos fixos do seed — exatamente o tipo de acoplamento que
// ClockService existe para eliminar.
const TEST_APP_TODAY = '2026-09-18';

export async function createTestApp(): Promise<TestApp> {
  const databaseUrl = await startTestDatabase();
  const redisUrl = await startTestRedis();

  // Precisa estar setado antes de compile(): é quando o Nest instancia
  // PrismaService e RedisService, e cada um lê sua env var na construção.
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
  process.env.APP_TODAY = TEST_APP_TODAY;

  const seeder = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await seed(seeder);
  await seeder.$disconnect();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();

  // createTestApp() monta a aplicação via Test.createTestingModule(), não
  // via bootstrap() de main.ts — configureApp() é a mesma função que
  // main.ts chama, para que o app testado nunca divirja do app de
  // produção (fix round 1, Finding 3: antes cada um tinha sua própria
  // cópia colada do setup do Swagger, e a cópia daqui era precisamente o
  // que provava /docs funcionar — uma divergência faria o teste validar
  // algo que o binário real não faz).
  configureApp(app);

  await app.init();

  const server = app.getHttpServer() as Server;

  return {
    server,

    async close() {
      // Sem o finally, um app.close() que lança (ou trava) deixa os dois
      // containers descartáveis para trás — testcontainers só os derruba de
      // verdade com o reaper, não instantaneamente, então isso pode
      // sobreviver ao processo de teste. allSettled garante que a falha de
      // um stop não impede a tentativa do outro.
      //
      // withTimeout é a segunda camada de defesa (fix round 1, Finding 1):
      // um `finally` só roda depois que a Promise do `try` SE RESOLVE (ou
      // rejeita) — contra um Postgres pausado (SIGSTOP), a chamada
      // PrismaService.onModuleDestroy() → $disconnect() dentro de
      // app.close() não faz nenhuma das duas, ela nunca se resolve.
      // Aconteceu de verdade durante este trabalho (duas vezes: Step 3 e o
      // teste de mutação), sempre exigindo `docker unpause`/`stop`/`rm`
      // manual para destravar o Jest — mesmo com o try/finally que já
      // existia aqui. Por isso este close() nunca deve esperar
      // indefinidamente por app.close(): passado o timeout, ele desiste,
      // loga bem alto (não silenciosamente) e segue para
      // stopTestRedis()/stopTestDatabase(), que derrubam os containers via
      // API do Docker independentemente de terem sido pausados ou não.
      const CLOSE_TIMEOUT_MS = 5_000;
      try {
        await withTimeout(
          app.close(),
          CLOSE_TIMEOUT_MS,
          `app.close() did not settle within ${CLOSE_TIMEOUT_MS}ms`,
        );
      } catch (error) {
        console.error(
          '[TestApp.close] app.close() timed out or failed — forcing container teardown anyway:',
          error,
        );
      } finally {
        await Promise.allSettled([stopTestRedis(), stopTestDatabase()]);
      }
    },

    async tokenFor(email: string, password: string): Promise<string> {
      const response = await request(server)
        .post('/auth/login')
        .send({ email, password });
      const body = response.body as { access_token?: unknown };

      if (typeof body.access_token !== 'string') {
        throw new Error(
          `login failed for ${email}: ${JSON.stringify(response.body)}`,
        );
      }

      return body.access_token;
    },

    stopDatabase: () => Promise.resolve(pauseTestDatabase()),
    startDatabase: () => Promise.resolve(unpauseTestDatabase()),
    stopRedis: () => Promise.resolve(pauseTestRedis()),
    startRedis: () => Promise.resolve(unpauseTestRedis()),
  };
}
