import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'

// Sem OTEL_EXPORTER_OTLP_ENDPOINT a telemetria fica inerte — é o que mantém
// os testes e o smoke test rápidos, já que nenhum deles roda com um
// coletor OTLP disponível.
export function setupTelemetry(): NodeSDK | null {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) return null

  const sdk = new NodeSDK({
    serviceName: 'gex-api',
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  })

  sdk.start()

  return sdk
}
