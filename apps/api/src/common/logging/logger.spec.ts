import type { Server } from 'node:http'
import { Controller, Get, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Logger as PinoNestLogger, LoggerModule } from 'nestjs-pino'
import request from 'supertest'
import { HttpExceptionFilter } from '../errors/http-exception.filter'
import { CORRELATION_HEADER, CorrelationMiddleware } from '../http/correlation.middleware'
import { buildLogger, redactionOptions } from './logger'

class CapturingStream {
  readonly chunks: string[] = []
  write(chunk: string): void {
    this.chunks.push(chunk)
  }
}

describe('log redaction', () => {
  it('redacts every credential-bearing path', () => {
    expect(redactionOptions.paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'seed_password',
        'password',
        'token',
        'refresh_token',
      ]),
    )
  })

  it('censors rather than removes, so the shape of the log stays stable', () => {
    expect(redactionOptions.censor).toBe('[REDACTED]')
  })
})

interface CapturedLine {
  password?: string
  supplierCnpj?: string
  amountCents?: number
  req?: { body?: { supplier_cnpj?: string; amount_cents?: number } }
}

describe('buildLogger redaction (through the real logger instance)', () => {
  // O teste anterior só olhava para redactionOptions.paths — uma lista pode
  // conter o nome certo e ainda assim nunca ser aplicada de verdade. Este
  // constrói o logger de produção e lê a linha que ele realmente escreveu.
  it('replaces password, supplierCnpj and amountCents with [REDACTED] in an emitted line', () => {
    const stream = new CapturingStream()
    const logger = buildLogger(stream)

    logger.info({
      password: 'hunter2',
      supplierCnpj: '12345678000199',
      amountCents: 125000,
      req: {
        body: { supplier_cnpj: '12345678000199', amount_cents: 125000 },
      },
    })

    expect(stream.chunks).toHaveLength(1)
    const line = JSON.parse(stream.chunks[0]) as CapturedLine

    expect(line.password).toBe('[REDACTED]')
    expect(line.supplierCnpj).toBe('[REDACTED]')
    expect(line.amountCents).toBe('[REDACTED]')
    expect(line.req?.body?.supplier_cnpj).toBe('[REDACTED]')
    expect(line.req?.body?.amount_cents).toBe('[REDACTED]')

    const raw = stream.chunks[0]
    expect(raw).not.toContain('hunter2')
    expect(raw).not.toContain('12345678000199')
  })
})

interface LoggedLine {
  level: number
  correlationId?: string
  err?: { message?: string; stack?: string }
}

@Controller('probe')
class ProbeController {
  @Get('boom')
  boom(): never {
    // Mensagem benigna: aqui se prova que a mensagem original chega ao log;
    // a redação de campos é testada nos blocos acima.
    throw new Error('falha ao processar a solicitação no banco de dados')
  }
}

// Monta só as peças de logging (LoggerModule com buildLogger, middleware de
// correlação e filtro global) num app Nest em memória: nada de banco, Redis
// ou AppModule, por isso roda na suíte unitária.
const buildTestApp = async (stream: CapturingStream): Promise<INestApplication<Server>> => {
  const moduleRef = await Test.createTestingModule({
    imports: [LoggerModule.forRoot({ pinoHttp: { logger: buildLogger(stream) } })],
    controllers: [ProbeController],
  }).compile()

  const app = moduleRef.createNestApplication<INestApplication<Server>>({
    bufferLogs: true,
  })
  // CorrelationMiddleware não tem dependências de construtor, então dá para
  // instanciar direto, sem precisar declará-lo num @Module com configure().
  app.use((req: unknown, res: unknown, next: () => void) =>
    new CorrelationMiddleware().use(req as never, res as never, next),
  )
  app.useLogger(app.get(PinoNestLogger))
  app.useGlobalFilters(new HttpExceptionFilter())
  await app.init()
  return app
}

const readLines = (stream: CapturingStream): LoggedLine[] =>
  stream.chunks
    .join('')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LoggedLine)

describe('buildLogger wired into Nest', () => {
  it('returns a sanitised 500 while logging the original error under the request correlationId', async () => {
    const stream = new CapturingStream()
    const app = await buildTestApp(stream)

    const response = await request(app.getHttpServer()).get('/probe/boom')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno' },
    })
    expect(JSON.stringify(response.body)).not.toContain('banco de dados')

    const correlationId = response.headers[CORRELATION_HEADER] as string | undefined
    expect(correlationId).toBeTruthy()

    // nível 50 = error no pino; é essa linha que prova que o comentário do
    // filtro ("vai para o log estruturado") deixou de ser ficção.
    const errorLines = readLines(stream).filter((line) => line.level === 50)
    expect(errorLines).toHaveLength(1)
    expect(errorLines[0].err?.message).toBe('falha ao processar a solicitação no banco de dados')
    expect(errorLines[0].err?.stack).toBeDefined()

    // O correlationId do header da resposta é o mesmo da linha de log: o
    // mixin lê o AsyncLocalStorage preenchido pelo middleware.
    expect(errorLines[0].correlationId).toBe(correlationId)

    await app.close()
  })
})
