import { buildLogger, redactionOptions } from './logger';

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
    );
  });

  it('censors rather than removes, so the shape of the log stays stable', () => {
    expect(redactionOptions.censor).toBe('[REDACTED]');
  });
});

interface CapturedLine {
  password?: string;
  supplierCnpj?: string;
  amountCents?: number;
  req?: { body?: { supplier_cnpj?: string; amount_cents?: number } };
}

class CapturingStream {
  readonly chunks: string[] = [];
  write(chunk: string): void {
    this.chunks.push(chunk);
  }
}

describe('buildLogger redaction (through the real logger instance)', () => {
  // O teste anterior só olhava para redactionOptions.paths — uma lista pode
  // conter o nome certo e ainda assim nunca ser aplicada de verdade. Este
  // constrói o logger de produção e lê a linha que ele realmente escreveu.
  it('replaces password, supplierCnpj and amountCents with [REDACTED] in an emitted line', () => {
    const stream = new CapturingStream();
    const logger = buildLogger(stream);

    logger.info({
      password: 'hunter2',
      supplierCnpj: '12345678000199',
      amountCents: 125000,
      req: {
        body: { supplier_cnpj: '12345678000199', amount_cents: 125000 },
      },
    });

    expect(stream.chunks).toHaveLength(1);
    const line = JSON.parse(stream.chunks[0]) as CapturedLine;

    expect(line.password).toBe('[REDACTED]');
    expect(line.supplierCnpj).toBe('[REDACTED]');
    expect(line.amountCents).toBe('[REDACTED]');
    expect(line.req?.body?.supplier_cnpj).toBe('[REDACTED]');
    expect(line.req?.body?.amount_cents).toBe('[REDACTED]');

    const raw = stream.chunks[0];
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('12345678000199');
  });
});
