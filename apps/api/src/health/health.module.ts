import { Module } from '@nestjs/common'
import { HealthDatabaseClient } from './health-database.client'
import { HealthController } from './health.controller'

// RedisService vem do RedisModule global. O banco é sondado por uma conexão
// dedicada, não pelo PrismaService que atende o tráfego (ver
// health-database.client.ts).
@Module({
  controllers: [HealthController],
  providers: [HealthDatabaseClient],
})
export class HealthModule {}
