import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { withTimeout } from '../common/utils/with-timeout'
import { shutdownTelemetry } from './telemetry'

const SHUTDOWN_TIMEOUT_MS = 3_000

// Último passo do desligamento: envia os spans pendentes, com prazo, para um
// coletor fora do ar não segurar a saída do processo.
@Injectable()
export class TelemetryLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(TelemetryLifecycle.name)

  async onApplicationShutdown(signal?: string): Promise<void> {
    await withTimeout(
      shutdownTelemetry(),
      SHUTDOWN_TIMEOUT_MS,
      'telemetry shutdown timed out',
    ).catch((error: unknown) =>
      this.logger.warn(
        `Telemetria não terminou de enviar no desligamento (${signal}): ${String(error)}`,
      ),
    )
  }
}
