import { Global, Module } from '@nestjs/common'
import { RedisService } from './redis.service'

// Global como PrismaModule e ClockModule: infraestrutura usada por vários
// domínios (auth, requests, dashboard, health).
@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
