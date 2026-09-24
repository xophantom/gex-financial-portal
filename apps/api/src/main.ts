import { setupTelemetry } from './infra/telemetry'

// Antes de qualquer import do Nest: em CommonJS cada `import` vira um
// `require()` na ordem do arquivo, e a auto-instrumentação só envolve módulos
// carregados depois dela.
setupTelemetry()

import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { configureApp } from './configure-app'

async function bootstrap() {
  // bufferLogs represa os logs do próprio boot do Nest até o pino assumir,
  // em vez de perdê-los para o ConsoleLogger padrão.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  // SIGTERM (docker stop) e SIGINT passam pelo ciclo do Nest: Prisma e Redis
  // desconectam, o servidor HTTP fecha e a telemetria envia o que falta.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'])
  configureApp(app)
  await app.listen(process.env.API_PORT ?? 3001)
}
void bootstrap()
