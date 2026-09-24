import { setupTelemetry } from './infra/telemetry';
import { withTimeout } from './common/utils/with-timeout';

// Precisa ser a primeira coisa executada, antes de qualquer import do Nest:
// apps/api compila para CommonJS, então cada `import` vira um `require()`
// avaliado na ordem textual do arquivo (ao contrário do hoisting de módulos
// ESM nativos) — chamar setupTelemetry() aqui garante que a instrumentação
// automática instale seus hooks antes de @nestjs/core, express, pg etc.
// serem carregados pela primeira vez. Carregado depois, não há mais nada
// para a auto-instrumentação envolver. `withTimeout` é importado antes
// dela só porque este arquivo o usa mais abaixo, ainda nesta seção — é uma
// função utilitária isolada, sem nenhum import do Nest por trás, então
// carregá-la aqui não atrapalha esse requisito.
const telemetry = setupTelemetry();

// Só registra os handlers de sinal quando a telemetria está realmente
// ativa. Duas razões para não registrar sempre:
// 1. Com a var de ambiente ausente, o comportamento tem que continuar
//    idêntico ao de antes desta mudança — o smoke test e um `docker stop`
//    comum contam com o desligamento padrão do Node (sair imediatamente).
// 2. Registrar QUALQUER listener de 'SIGTERM'/'SIGINT' tira do Node a
//    responsabilidade de encerrar o processo sozinho — se o handler não
//    chamar process.exit() explicitamente, o processo passa a IGNORAR o
//    sinal e nunca mais responde a um `docker stop` (ou ao
//    `child.kill('SIGTERM')` do smoke test), travado até um SIGKILL. Por
//    isso o handler abaixo sempre termina em process.exit(), inclusive
//    quando o flush da telemetria trava (withTimeout limita essa espera a
//    3s, para um coletor OTLP fora do ar nunca virar um shutdown que não
//    termina).
if (telemetry) {
  const shutdown = (signal: NodeJS.Signals) => {
    void withTimeout(
      telemetry.shutdown(),
      3_000,
      'telemetry shutdown timed out',
    )
      .catch((error: unknown) => {
        // Ainda não há logger do Nest disponível aqui (o app pode nem
        // existir mais, ou nunca ter chegado a existir).
        console.error(
          `[telemetry] shutdown on ${signal} did not finish cleanly:`,
          error,
        );
      })
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  // bufferLogs represa os logs do próprio boot do Nest até o pino assumir,
  // em vez de perdê-los para o ConsoleLogger padrão.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  await app.listen(process.env.API_PORT ?? 3001);
}
void bootstrap();
