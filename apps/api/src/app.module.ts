import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClockModule } from './clock/clock.module';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, ClockModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
