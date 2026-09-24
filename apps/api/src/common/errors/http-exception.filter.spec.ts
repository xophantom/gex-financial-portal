import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ErrorEnvelope } from '@gex/shared';
import { ZodError, z } from 'zod';
import { AppException } from './app.exception';
import { HttpExceptionFilter } from './http-exception.filter';

interface FakeResponse {
  status: (code: number) => FakeResponse;
  json: (payload: unknown) => void;
}

const capture = (exception: unknown) => {
  const body: unknown[] = [];
  // Tipado como `(code: number) => FakeResponse` em vez de deixar o jest.fn()
  // inferir `any`: mockReturnThis() ainda devolve o `this` de chamada (o
  // próprio response), só que agora sob um tipo real, não sob any implícito.
  const statusMock = jest.fn<FakeResponse, [number]>().mockReturnThis();
  const response: FakeResponse = {
    status: statusMock,
    json: (payload) => {
      body.push(payload);
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/x' }),
    }),
  };

  new HttpExceptionFilter().catch(exception, host as never);

  return {
    status: statusMock.mock.calls[0][0],
    body: body[0] as ErrorEnvelope,
  };
};

describe('HttpExceptionFilter', () => {
  it('renders an AppException with its code and status', () => {
    const { status, body } = capture(
      new AppException('DUPLICATE_INVOICE', 'Nota já cadastrada', 409),
    );

    expect(status).toBe(409);
    expect(body).toEqual({
      error: { code: 'DUPLICATE_INVOICE', message: 'Nota já cadastrada' },
    });
  });

  it('turns a ZodError into a 422 with per-field details', () => {
    const schema = z.object({
      amount_cents: z.number().positive('Deve ser positivo'),
    });
    let error!: ZodError;

    try {
      schema.parse({ amount_cents: -1 });
    } catch (caught) {
      error = caught as ZodError;
    }

    const { status, body } = capture(error);

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual([
      { field: 'amount_cents', message: 'Deve ser positivo' },
    ]);
  });

  it('maps the router 404 to NOT_FOUND with a Portuguese message', () => {
    const { status, body } = capture(new NotFoundException('Cannot GET /x'));

    expect(status).toBe(404);
    expect(body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada' },
    });
  });

  // ParseUUIDPipe e JSON malformado chegam como BadRequestException.
  it('maps a Nest BadRequestException to VALIDATION_ERROR at 422', () => {
    const { status, body } = capture(
      new BadRequestException('Validation failed (uuid is expected)'),
    );

    expect(status).toBe(422);
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos' },
    });
  });

  it('maps a body-parser client error instead of answering 500', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });

    const { status, body } = capture(tooLarge);

    expect(status).toBe(413);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('O corpo da requisição é grande demais');
  });

  // Um ConflictException genérico não diz qual conflito é; os de negócio usam
  // AppException com código próprio.
  it('maps a Nest ConflictException to the generic CONFLICT at 409', () => {
    const { status, body } = capture(new ConflictException('conflito'));

    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('maps an unknown error to a 500 without leaking its message', () => {
    const { status, body } = capture(
      new Error('connection string user:password@host'),
    );

    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('password');
  });

  it('never includes a stack trace in the response', () => {
    const { body } = capture(new BadRequestException('bad'));
    expect(JSON.stringify(body)).not.toContain('at ');
  });
});
