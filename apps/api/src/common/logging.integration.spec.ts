import type { Server } from 'node:http';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger as PinoNestLogger, LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import {
  CORRELATION_HEADER,
  CorrelationMiddleware,
} from './correlation.middleware';
import { HttpExceptionFilter } from './http-exception.filter';
import { buildLogger } from './logger';

class CapturingStream {
  readonly chunks: string[] = [];
  write(chunk: string): void {
    this.chunks.push(chunk);
  }
}

interface LoggedLine {
  level: number;
  correlationId?: string;
  err?: { message?: string; stack?: string };
}

@Controller('probe')
class ProbeController {
  @Get('boom')
  boom(): never {
    // Mensagem benigna: aqui se prova que a mensagem original chega ao log;
    // a redação de campos é testada em logger.spec.ts.
    throw new Error('falha ao processar a solicitação no banco de dados');
  }
}

const buildTestApp = async (
  stream: CapturingStream,
): Promise<INestApplication<Server>> => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      LoggerModule.forRoot({ pinoHttp: { logger: buildLogger(stream) } }),
    ],
    controllers: [ProbeController],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<Server>>({
    bufferLogs: true,
  });
  // CorrelationMiddleware não tem dependências de construtor, então dá para
  // instanciar direto, sem precisar declará-lo num @Module com configure().
  app.use((req: unknown, res: unknown, next: () => void) =>
    new CorrelationMiddleware().use(req as never, res as never, next),
  );
  app.useLogger(app.get(PinoNestLogger));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
};

const readLines = (stream: CapturingStream): LoggedLine[] =>
  stream.chunks
    .join('')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LoggedLine);

describe('logging wiring (integration)', () => {
  it('returns a sanitised 500 while logging the original error under the request correlationId', async () => {
    const stream = new CapturingStream();
    const app = await buildTestApp(stream);

    const response = await request(app.getHttpServer()).get('/probe/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno' },
    });
    expect(JSON.stringify(response.body)).not.toContain('banco de dados');

    const correlationId = response.headers[CORRELATION_HEADER] as
      string | undefined;
    expect(correlationId).toBeTruthy();

    // nível 50 = error no pino; é essa linha que prova que o comentário do
    // filtro ("vai para o log estruturado") deixou de ser ficção.
    const errorLines = readLines(stream).filter((line) => line.level === 50);
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0].err?.message).toBe(
      'falha ao processar a solicitação no banco de dados',
    );
    expect(errorLines[0].err?.stack).toBeDefined();

    // O correlationId do header da resposta é o mesmo da linha de log: o
    // mixin lê o AsyncLocalStorage preenchido pelo middleware.
    expect(errorLines[0].correlationId).toBe(correlationId);

    await app.close();
  });
});
