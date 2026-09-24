import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { HttpExceptionFilter } from './common/errors/http-exception.filter'

// Usado por main.ts e pelos testes e2e, para o app testado ser o de produção.
// O Swagger registra /docs direto no adapter HTTP, fora dos guards, e documenta
// os mesmos schemas Zod que validam a entrada (via createZodDto).
export function configureApp(app: INestApplication): void {
  app.useGlobalFilters(new HttpExceptionFilter())

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Portal de Solicitações Financeiras')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  )
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document))
}
