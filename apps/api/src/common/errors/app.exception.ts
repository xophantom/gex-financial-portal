import type { ErrorCode, ErrorDetail } from '@gex/shared';

// Erro de negócio com código e status explícitos; o HttpExceptionFilter o
// renderiza como está, sem passar pela tradução dos erros do Nest/Express.
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
