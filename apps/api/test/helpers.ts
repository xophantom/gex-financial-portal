import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BigIntInterceptor } from '../src/common/bigint.interceptor';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
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
  app.useGlobalInterceptors(new BigIntInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // createTestApp() monta a aplicação via Test.createTestingModule(), não
  // via bootstrap() de main.ts — sem repetir aqui o mesmo setup do Swagger
  // (como já se repete BigIntInterceptor e HttpExceptionFilter acima), o
  // teste e2e de /docs nunca veria a rota, e um /health ou /docs que só
  // existe no main.ts de produção não é provado por nenhum teste.
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Portal de Solicitações Financeiras')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

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
      try {
        await app.close();
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
