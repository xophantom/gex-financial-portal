import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// Global como PrismaModule e ClockModule: é infraestrutura consumida por
// mais de um domínio (rate limit de login hoje, health check degradado na
// Tarefa 16), não algo específico do módulo de autenticação.
@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
