import { redactionOptions } from './logger';

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
