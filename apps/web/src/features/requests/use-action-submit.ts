import type { ErrorEnvelope } from '@gex/shared'
import { useRef, useState } from 'react'

// Envio compartilhado pelos diálogos de ação (aprovar, rejeitar, pagar):
// POST no BFF, mensagem de erro do envelope da API e trava contra envio
// duplo.
export function useActionSubmit(onSuccess: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // isSubmitting só desabilita o botão no próximo render; o ref barra um
  // segundo clique que chegue antes disso.
  const inFlight = useRef(false)

  const submit = async (url: string, payload: unknown) => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body: Partial<ErrorEnvelope> | null = await response.json().catch(() => null)
        setError(body?.error?.message ?? 'Erro inesperado')
        return
      }

      onSuccess()
    } catch {
      setError('Não foi possível falar com o servidor. Tente novamente.')
    } finally {
      inFlight.current = false
      setIsSubmitting(false)
    }
  }

  return { error, setError, isSubmitting, submit }
}
