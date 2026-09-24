import type { Server } from 'node:http'
import { Controller, Get, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { HttpExceptionFilter } from '../common/errors/http-exception.filter'
import { PrismaModule } from '../infra/prisma/prisma.module'
import { PrismaService } from '../infra/prisma/prisma.service'
import { RedisModule } from '../infra/redis/redis.module'
import { RedisService } from '../infra/redis/redis.service'
import { AuthModule } from './auth.module'
import { resolveJwtSecret } from './jwt-secrets'

// Testa a mesma factory que o AuthModule usa no JwtModule, isolada de
// PrismaModule/RedisModule: quando compile() falha no meio da montagem, as
// conexões reais deles ficam abertas e a suíte não termina.
describe('AuthModule JWT provider', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('refuses to resolve the JWT provider when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET

    await expect(
      Test.createTestingModule({
        imports: [
          JwtModule.registerAsync({
            useFactory: () => ({ secret: resolveJwtSecret() }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/JWT_SECRET/)
  })
})

@Controller('naked')
class NakedController {
  @Get()
  ping(): { ok: true } {
    return { ok: true }
  }
}

@Module({ controllers: [NakedController] })
class NakedModule {}

// Um controller sem @UseGuards ao lado do AuthModule: prova que a proteção
// vem dos APP_GUARD globais que AuthModule registra, não de cada controller
// lembrar de pedi-la. Prisma e Redis entram substituídos por dublês, então
// nenhuma conexão real é aberta.
describe('AuthModule global guards (default deny)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.JWT_SECRET = 'auth-module-spec-secret'
    process.env.JWT_REFRESH_SECRET = 'auth-module-spec-refresh-secret'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  const buildApp = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, RedisModule, AuthModule, NakedModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: () => null } })
      .overrideProvider(RedisService)
      .useValue({ get: () => null, incrWithTtl: () => 1, delKey: () => undefined })
      .compile()

    const app = moduleRef.createNestApplication()
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    return app
  }

  it('refuses an unauthenticated request to a controller with no @UseGuards', async () => {
    const app = await buildApp()

    await request(app.getHttpServer() as Server)
      .get('/naked')
      .expect(401)

    await app.close()
  })

  it('still lets an unauthenticated request through a route marked @Public()', async () => {
    const app = await buildApp()

    // Usuário inexistente: chega ao controller e falha em AuthService.login
    // de verdade (401 "E-mail ou senha inválidos"). As duas causas de 401 têm
    // o mesmo code (UNAUTHENTICATED); o que as distingue é a mensagem — "Não
    // autenticado" seria o JwtGuard barrando antes do controller, o que
    // aconteceria se @Public() não estivesse funcionando.
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: 'ana@gex.test', password: 'wrong' })

    expect(response.status).toBe(401)
    expect((response.body as { error: { message: string } }).error.message).toBe(
      'E-mail ou senha inválidos',
    )

    await app.close()
  })
})
