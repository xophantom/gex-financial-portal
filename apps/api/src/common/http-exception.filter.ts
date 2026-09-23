import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ErrorCode, ErrorDetail } from '@gex/shared';
import type { Response } from 'express';
import { ZodError } from 'zod';

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
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'DUPLICATE_INVOICE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
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

    if (exception instanceof ZodError) {
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
    // vai para o log estruturado, nunca para a resposta.
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno' },
    });
  }
}
