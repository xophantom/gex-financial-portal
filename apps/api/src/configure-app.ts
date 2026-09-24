import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';

// Usado por main.ts e pelos testes e2e, para que o app testado seja o mesmo
// que roda em produção.
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
