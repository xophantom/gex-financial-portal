import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService e RedisService não precisam entrar em imports: PrismaModule
// e RedisModule são @Global(), então já estão disponíveis para injeção aqui.
@Module({ controllers: [HealthController] })
export class HealthModule {}
