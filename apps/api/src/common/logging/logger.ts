import pino from 'pino'
import { correlationStore } from '../http/correlation.middleware'

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
    // CNPJ completo e valor em centavos são dado financeiro/documento cheio,
    // vedados pelo enunciado nos logs — cobertos tanto no formato de domínio
    // (camelCase, como um objeto Prisma) quanto no corpo bruto da requisição
    // (snake_case, como o cliente realmente envia).
    'supplierCnpj',
    'amountCents',
    'req.body.supplier_cnpj',
    'req.body.amount_cents',
  ],
  censor: '[REDACTED]',
}

export function buildLogger(destination?: pino.DestinationStream): pino.Logger {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: redactionOptions,
      // Sem isso, logar um Error crua vira `err: {}`: message e stack não são
      // enumeráveis, então o serializer padrão do pino é quem sabe extraí-los.
      serializers: { err: pino.stdSerializers.err },
      mixin: () => ({
        correlationId: correlationStore.getStore()?.correlationId,
      }),
    },
    destination,
  )
}
