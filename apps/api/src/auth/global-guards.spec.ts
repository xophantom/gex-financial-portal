import type { Server } from 'node:http';
import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';

@Controller('naked')
class NakedController {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [NakedController] })
class NakedModule {}

// Um controller sem @UseGuards ao lado do AuthModule: prova que a proteção
// vem dos APP_GUARD globais, não de cada controller lembrar de pedi-la.
describe('global guards (default deny)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'global-guards-spec-secret';
    process.env.JWT_REFRESH_SECRET = 'global-guards-spec-refresh-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('refuses an unauthenticated request to a controller with no @UseGuards', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, RedisModule, AuthModule, NakedModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: () => null } })
      .overrideProvider(RedisService)
      .useValue({ incrWithTtl: () => 1, delKey: () => undefined })
      .compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    await request(app.getHttpServer() as Server)
      .get('/naked')
      .expect(401);

    await app.close();
  });

  it('still lets an unauthenticated request through a route marked @Public()', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, RedisModule, AuthModule, NakedModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: () => null } })
      .overrideProvider(RedisService)
      .useValue({ incrWithTtl: () => 1, delKey: () => undefined })
      .compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    // Usuário inexistente: chega ao controller e falha em AuthService.login
    // de verdade (401 "E-mail ou senha inválidos"). As duas causas de 401 têm
    // o mesmo code (UNAUTHENTICATED); o que as distingue é a mensagem — "Não
    // autenticado" seria o JwtGuard barrando antes do controller, o que
    // aconteceria se @Public() não estivesse funcionando.
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: 'ana@gex.test', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(
      (response.body as { error: { message: string } }).error.message,
    ).toBe('E-mail ou senha inválidos');

    await app.close();
  });
});
