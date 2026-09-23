import pino from 'pino';
import { correlationStore } from './correlation.middleware';

export const redactionOptions = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'req.body.password',
    'password',
    'seed_password',
    'passwordHash',
    'token',
    'access_token',
    'refresh_token',
  ],
  censor: '[REDACTED]',
};

export function buildLogger(): pino.Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: redactionOptions,
    mixin: () => ({
      correlationId: correlationStore.getStore()?.correlationId,
    }),
  });
}
