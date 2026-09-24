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
import { AppException } from './app.exception';

interface ZodLikeError extends Error {
  issues: { path: (string | number)[]; message: string }[];
}

// Pela forma, não por `instanceof ZodError`: a API (CommonJS) e o
// @gex/shared (ESM) carregam builds diferentes do zod, com classes distintas.
function isZodLikeError(exception: unknown): exception is ZodLikeError {
  return (
    exception instanceof Error &&
    exception.name === 'ZodError' &&
    Array.isArray((exception as { issues?: unknown }).issues)
  );
}

interface HttpErrorMapping {
  code: ErrorCode;
  message: string;
  status?: number;
}

// Erros do Nest e do Express chegam com texto em inglês ("Cannot GET /x",
// "Unexpected token..."); a resposta usa uma mensagem fixa em PT-BR. 400 vira
// 422 para que dado inválido (UUID, JSON malformado) tenha um status só.
// Conflitos específicos usam AppException (DUPLICATE_INVOICE etc.).
const HTTP_ERRORS: Record<number, HttpErrorMapping> = {
  [HttpStatus.BAD_REQUEST]: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'VALIDATION_ERROR',
    message: 'Dados inválidos',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'UNAUTHENTICATED',
    message: 'Não autenticado',
  },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'Acesso negado' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Rota não encontrada' },
  [HttpStatus.CONFLICT]: { code: 'CONFLICT', message: 'Conflito' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'VALIDATION_ERROR',
    message: 'O corpo da requisição é grande demais',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: 'VALIDATION_ERROR',
    message: 'Dados inválidos',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Muitas tentativas. Tente novamente em instantes.',
  },
};

// body-parser rejeita com http-errors (ex.: 413), que não são HttpException.
function httpStatusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) return exception.getStatus();

  const candidate = exception as { status?: unknown; expose?: unknown };
  if (
    exception instanceof Error &&
    candidate.expose === true &&
    typeof candidate.status === 'number'
  ) {
    return candidate.status;
  }

  return undefined;
}

function mappingFor(status: number): HttpErrorMapping {
  return (
    HTTP_ERRORS[status] ??
    (status >= 500
      ? { code: 'INTERNAL_ERROR', message: 'Erro interno' }
      : { code: 'VALIDATION_ERROR', message: 'Requisição inválida' })
  );
}

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

    const status = httpStatusOf(exception);
    if (status !== undefined) {
      if (status >= 500) this.logger.error(exception);
      const mapping = mappingFor(status);
      response.status(mapping.status ?? status).json({
        error: { code: mapping.code, message: mapping.message },
      });
      return;
    }

    // A mensagem original pode conter connection string ou segredo: vai só
    // para o log estruturado, nunca para a resposta.
    this.logger.error(
      exception instanceof Error ? exception : new Error(String(exception)),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno' },
    });
  }
}
