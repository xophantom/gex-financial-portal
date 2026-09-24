import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'

// Sem imports do Nest: main.ts carrega este arquivo antes de tudo, e a
// auto-instrumentação só envolve módulos carregados depois dela.

let sdk: NodeSDK | null = null

// Sem OTEL_EXPORTER_OTLP_ENDPOINT a telemetria fica inerte — é o que mantém
// os testes e o smoke test rápidos, já que nenhum deles roda com um
// coletor OTLP disponível.
export function setupTelemetry(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) return

  sdk = new NodeSDK({
    serviceName: 'gex-api',
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  })

  sdk.start()
}

// Envia os spans que ainda estão no buffer; chamado no desligamento do Nest.
export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown()
}
