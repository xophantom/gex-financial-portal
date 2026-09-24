import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const correlationStore = new AsyncLocalStorage<{
  correlationId: string;
}>();

export const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(CORRELATION_HEADER);
    const correlationId =
      incoming && incoming.length <= 64 ? incoming : randomUUID();

    response.setHeader(CORRELATION_HEADER, correlationId);
    correlationStore.run({ correlationId }, next);
  }
}
