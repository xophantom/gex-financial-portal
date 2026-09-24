import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { CorrelationMiddleware } from './common/http/correlation.middleware';
import { buildLogger } from './common/logging/logger';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { ClockModule } from './infra/clock/clock.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [
    // A mesma instância de buildLogger() (redact + mixin de correlationId)
    // vira o logger interno do Nest inteiro, não só das requisições HTTP.
    LoggerModule.forRoot({ pinoHttp: { logger: buildLogger() } }),
    PrismaModule,
    ClockModule,
    RedisModule,
    AuthModule,
    DashboardModule,
    RequestsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
