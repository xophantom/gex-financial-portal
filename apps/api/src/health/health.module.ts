import { Module } from '@nestjs/common'
import { HealthDatabaseClient } from './health-database.client'
import { HealthController } from './health.controller'

// RedisService não precisa entrar em imports: RedisModule é @Global(), já
// está disponível para injeção aqui. HealthDatabaseClient é diferente de
// PrismaService de propósito — é uma conexão dedicada e local a este
// módulo, não a instância @Global() que atende tráfego real (ver o
// comentário em health-database.client.ts).
@Module({
  controllers: [HealthController],
  providers: [HealthDatabaseClient],
})
export class HealthModule {}
