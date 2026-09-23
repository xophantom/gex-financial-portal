import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ErrorCode, ErrorDetail } from '@gex/shared';
import type { Response } from 'express';

interface ZodLikeError extends Error {
  issues: { path: (string | number)[]; message: string }[];
}

// Não usa `instanceof ZodError`: apps/api compila para CommonJS (tsconfig
// "nodenext" sem "type": "module") e faz require('zod'), enquanto @gex/shared
// é ESM e importa 'zod' via import — o pacote zod 3.25.x publica builds CJS e
// ESM genuinamente separados (dois arquivos, não um wrapper fino), então são
// duas classes ZodError distintas em runtime e instanceof falha, caindo no
// branch genérico de 500. Confirmado batendo no binário compilado de
// verdade: login com e-mail inválido e GET /requests?page=0 voltavam 500 em
// vez de 422. Checar a forma do erro (nome + issues), em vez da identidade
// da classe, funciona não importa de qual build do zod ele veio.
function isZodLikeError(exception: unknown): exception is ZodLikeError {
  return (
    exception instanceof Error &&
    exception.name === 'ZodError' &&
    Array.isArray((exception as { issues?: unknown }).issues)
  );
}

export class AppException extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
  }
}

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  // 409 é o status de mais de um tipo de conflito (nota duplicada, transição
  // de status inválida etc.) e o filtro não tem como inferir qual, só pelo
  // status, então mapeia para um código genérico. Um conflito específico deve
  // ser lançado como AppException com o código próprio (ex.: DUPLICATE_INVOICE,
  // INVALID_TRANSITION), não como um ConflictException genérico.
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      response.status(exception.status).json({
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details && { details: exception.details }),
        },
      });
      return;
    }

    if (isZodLikeError(exception)) {
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: exception.issues.map((issue): ErrorDetail => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        error: {
          code: STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR',
          message: exception.message,
        },
      });
      return;
    }

    // A mensagem original pode conter connection string ou segredo; o detalhe
    // vai para o log estruturado (nível error, com correlationId via mixin),
    // nunca para a resposta.
    this.logger.error(
      exception instanceof Error ? exception : new Error(String(exception)),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno' },
    });
  }
}
