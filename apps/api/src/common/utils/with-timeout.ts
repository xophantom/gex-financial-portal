// Compartilhado entre qualquer chamada que dependa de uma dependência
// externa capaz de congelar sem nunca rejeitar — um Postgres/Redis
// pausado via `docker pause` (SIGSTOP: soquete fica aberto, mas nada
// nunca responde, sem RST e sem timeout de rede) ou um coletor OTLP fora
// do ar. Nenhuma promessa de fora do processo deve conseguir prendê-lo
// para sempre; usado pelo probe de health, pela conexão inicial do
// RedisService e pelo desligamento da telemetria em main.ts.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}
