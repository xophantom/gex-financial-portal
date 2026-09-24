import { setupTelemetry } from './telemetry';

// Precisa ser a primeira coisa executada, antes de qualquer import do Nest:
// apps/api compila para CommonJS, então cada `import` vira um `require()`
// avaliado na ordem textual do arquivo (ao contrário do hoisting de módulos
// ESM nativos) — chamar setupTelemetry() aqui garante que a instrumentação
// automática instale seus hooks antes de @nestjs/core, express, pg etc.
// serem carregados pela primeira vez. Carregado depois, não há mais nada
// para a auto-instrumentação envolver.
setupTelemetry();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
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

  // SwaggerModule.setup registra suas rotas direto no adapter HTTP
  // (httpAdapter.get(...)), sem passar pelo pipeline de guards do Nest —
  // por isso /docs não precisa de @Public() para ficar acessível sem token.
  // O documento nasce de SwaggerModule.createDocument, que introspecciona os
  // controllers já registrados; cleanupOpenApiDoc (nestjs-zod) pós-processa
  // o resultado para os DTOs criados via createZodDto, que são os mesmos
  // schemas Zod usados para validar a entrada — não existe uma segunda
  // definição da API para ficar desatualizada.
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Portal de Solicitações Financeiras')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  await app.listen(process.env.API_PORT ?? 3001);
}
void bootstrap();
