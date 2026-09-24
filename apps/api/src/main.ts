import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './common/bigint.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  // bufferLogs represa os logs do próprio boot do Nest até o pino assumir,
  // em vez de perdê-los para o ConsoleLogger padrão.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new BigIntInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.API_PORT ?? 3001);
}
void bootstrap();
