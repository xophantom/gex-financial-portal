import { setupTelemetry } from './infra/telemetry'
import { withTimeout } from './common/utils/with-timeout'

// Antes de qualquer import do Nest: em CommonJS cada `import` vira um
// `require()` na ordem do arquivo, e a auto-instrumentação só envolve módulos
// carregados depois dela.
const telemetry = setupTelemetry()

// Handlers de sinal só com telemetria ativa: registrar um listener tira do
// Node o encerramento padrão, então o handler sempre termina em process.exit(),
// mesmo se o flush para o coletor travar (limitado a 3s).
if (telemetry) {
  const shutdown = (signal: NodeJS.Signals) => {
    void withTimeout(telemetry.shutdown(), 3_000, 'telemetry shutdown timed out')
      .catch((error: unknown) => {
        // O logger do Nest pode nem existir aqui.
        console.error(`[telemetry] shutdown on ${signal} did not finish cleanly:`, error)
      })
      .finally(() => process.exit(0))
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { configureApp } from './configure-app'

async function bootstrap() {
  // bufferLogs represa os logs do próprio boot do Nest até o pino assumir,
  // em vez de perdê-los para o ConsoleLogger padrão.
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  configureApp(app)
  await app.listen(process.env.API_PORT ?? 3001)
}
void bootstrap()
