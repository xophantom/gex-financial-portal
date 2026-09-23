import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ClockModule } from './clock/clock.module';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { buildLogger } from './common/logger';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // A mesma instância de buildLogger() (redact + mixin de correlationId)
    // vira o logger interno do Nest inteiro, não só das requisições HTTP.
    LoggerModule.forRoot({ pinoHttp: { logger: buildLogger() } }),
    PrismaModule,
    ClockModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
