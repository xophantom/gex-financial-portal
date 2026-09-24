// Limita a espera por uma dependência externa que pode congelar sem nunca
// rejeitar (Postgres/Redis pausados, coletor OTLP fora do ar). Usado pelo
// health check, pela conexão inicial do Redis e pelo desligamento da telemetria.
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
