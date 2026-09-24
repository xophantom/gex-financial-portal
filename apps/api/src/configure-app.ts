import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { BigIntInterceptor } from './common/bigint.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

// Único lugar que aplica os filtros/interceptors globais e monta a
// documentação Swagger. main.ts (bootstrap real) e test/helpers.ts
// (createTestApp, usado por todo teste e2e) chamam exatamente esta função —
// antes cada um tinha sua própria cópia colada lado a lado, e a cópia de
// helpers.ts era precisamente o que provava /docs funcionar: se as duas
// divergissem, o teste passaria validando um comportamento que o binário de
// produção não tem (fix round 1, Finding 3).
//
// SwaggerModule.setup registra suas rotas direto no adapter HTTP
// (httpAdapter.get(...)), sem passar pelo pipeline de guards do Nest — por
// isso /docs não precisa de @Public() para ficar acessível sem token. O
// documento nasce de SwaggerModule.createDocument, que introspecciona os
// controllers já registrados; cleanupOpenApiDoc (nestjs-zod) pós-processa o
// resultado para os DTOs criados via createZodDto, que são os mesmos
// schemas Zod usados para validar a entrada — não existe uma segunda
// definição da API para ficar desatualizada.
export function configureApp(app: INestApplication): void {
  app.useGlobalInterceptors(new BigIntInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Portal de Solicitações Financeiras')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));
}
