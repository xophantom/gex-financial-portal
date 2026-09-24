import type { ErrorDetail, ErrorEnvelope } from '@gex/shared'
import { useRef, useState } from 'react'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

// Issues do Zod no mesmo formato dos details da API, para as duas validações
// (a local e a do servidor) acabarem no mesmo campo.
export const issuesAsDetails = (
  issues: { path: PropertyKey[]; message: string }[],
): ErrorDetail[] => issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))

// Primeira mensagem de cada campo que o diálogo exibe; o resto é ignorado.
export function fieldErrorsFrom<Field extends string>(
  fields: readonly Field[],
  details: ErrorDetail[] = [],
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  for (const { field, message } of details) {
    const known = fields.find((name) => name === field)
    if (known && !errors[known]) errors[known] = message
  }
  return errors
}

// Envio compartilhado pelos diálogos de ação (aprovar, rejeitar, pagar): POST
// no BFF, erros por campo (da validação local ou dos details da API), a
// mensagem geral para o resto e trava contra envio duplo.
export function useActionSubmit<Field extends string>(
  fields: readonly Field[],
  onSuccess: () => void,
) {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // isSubmitting só desabilita o botão no próximo render; o ref barra um
  // segundo clique que chegue antes disso.
  const inFlight = useRef(false)

  const clearFieldError = (field: Field) =>
    setFieldErrors((current) => ({ ...current, [field]: undefined }))

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
        const onFields = fieldErrorsFrom(fields, body?.error?.details)

        if (Object.keys(onFields).length > 0) setFieldErrors(onFields)
        else
          setError(
            body?.error?.message ?? 'A ação não foi concluída. Tente novamente em instantes.',
          )
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

  return { error, fieldErrors, setFieldErrors, clearFieldError, isSubmitting, submit }
}
