import type { Server } from 'node:http'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { seed } from '../../prisma/seed'
import { AppModule } from '../../src/app.module'
import { withTimeout } from '../../src/common/utils/with-timeout'
import { configureApp } from '../../src/configure-app'
import {
  pauseTestDatabase,
  pauseTestRedis,
  startTestDatabase,
  startTestRedis,
  stopTestDatabase,
  stopTestRedis,
  unpauseTestDatabase,
  unpauseTestRedis,
} from './containers'

export interface TestApp {
  server: Server
  close(): Promise<void>
  tokenFor(email: string, password: string): Promise<string>
  stopDatabase(): Promise<void>
  startDatabase(): Promise<void>
  stopRedis(): Promise<void>
  startRedis(): Promise<void>
}

// Segredos fixos: o ambiente de teste é descartável.
const TEST_JWT_SECRET = 'test-jwt-secret'
const TEST_JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
// Data de referência fixa: com o relógio real, as asserções de "vencida"
// sobre o seed quebrariam com o passar dos dias.
const TEST_APP_TODAY = '2026-09-18'

export async function createTestApp(): Promise<TestApp> {
  const databaseUrl = await startTestDatabase()
  const redisUrl = await startTestRedis()

  // Precisa estar setado antes de compile(): é quando o Nest instancia
  // PrismaService e RedisService, e cada um lê sua env var na construção.
  process.env.DATABASE_URL = databaseUrl
  process.env.REDIS_URL = redisUrl
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET
  process.env.APP_TODAY = TEST_APP_TODAY

  const seeder = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  })
  await seed(seeder)
  await seeder.$disconnect()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()
  const app = moduleRef.createNestApplication<NestExpressApplication>()

  // Mesma configuração de main.ts, para o app testado não divergir do real.
  configureApp(app)

  await app.init()

  const server: Server = app.getHttpServer()

  return {
    server,

    async close() {
      // Contra um Postgres pausado, app.close() pode nunca resolver: o
      // timeout garante que os containers sejam derrubados mesmo assim, e o
      // allSettled que a falha de um não impeça o stop do outro.
      const CLOSE_TIMEOUT_MS = 5_000
      try {
        await withTimeout(
          app.close(),
          CLOSE_TIMEOUT_MS,
          `app.close() did not settle within ${CLOSE_TIMEOUT_MS}ms`,
        )
      } catch (error) {
        console.error(
          '[TestApp.close] app.close() timed out or failed — forcing container teardown anyway:',
          error,
        )
      } finally {
        await Promise.allSettled([stopTestRedis(), stopTestDatabase()])
      }
    },

    async tokenFor(email: string, password: string): Promise<string> {
      const response = await request(server).post('/auth/login').send({ email, password })
      const body = response.body as { access_token?: unknown }

      if (typeof body.access_token !== 'string') {
        throw new Error(`login failed for ${email}: ${JSON.stringify(response.body)}`)
      }

      return body.access_token
    },

    stopDatabase: () => Promise.resolve(pauseTestDatabase()),
    startDatabase: () => Promise.resolve(unpauseTestDatabase()),
    stopRedis: () => Promise.resolve(pauseTestRedis()),
    startRedis: () => Promise.resolve(unpauseTestRedis()),
  }
}
