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

// A prova exata que teria pego o Finding 4 do fix round 2: um controller sem
// NENHUM @UseGuards, montado ao lado de AuthModule (de onde vêm os
// APP_GUARD globais). Se a proteção continuasse "opt-in por controller" — só
// existindo porque algum controller lembrou de declarar @UseGuards — o
// primeiro teste abaixo falharia (200 em vez de 401), porque nada aqui pede
// JwtGuard/RolesGuard explicitamente. PrismaService/RedisService são
// mockados: nada aqui precisa de banco ou Redis de verdade, só da cadeia de
// guards.
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
