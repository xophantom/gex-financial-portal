'use client'

import { useId, useRef, useState } from 'react'

const DECISION_TITLES: Record<'APPROVE' | 'REJECT', string> = {
  APPROVE: 'Aprovar solicitação',
  REJECT: 'Rejeitar solicitação',
}

const fieldClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950'
const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'

function useActionSubmit(onSuccess: () => void) {
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
      const body = await response.json().catch(() => null)

      if (!response.ok) {
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

function DialogActions({
  onClose,
  onConfirm,
  isSubmitting,
}: {
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Confirmar
      </button>
    </div>
  )
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  )
}

export interface DecisionDialogProps {
  requestId: string
  decision: 'APPROVE' | 'REJECT'
  onClose: () => void
  onSuccess: () => void
}

// A decisão é fixa por diálogo: o servidor já definiu, via allowed_actions,
// quais botões existem.
export function DecisionDialog({ requestId, decision, onClose, onSuccess }: DecisionDialogProps) {
  const titleId = useId()
  const [reason, setReason] = useState('')
  const { error, setError, isSubmitting, submit } = useActionSubmit(onSuccess)

  const handleConfirm = () => {
    if (decision === 'REJECT' && reason.trim() === '') {
      setError('Informe o motivo da rejeição')
      return
    }

    void submit(`/api/requests/${requestId}/decision`, {
      decision,
      reason: decision === 'REJECT' ? reason : undefined,
    })
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="space-y-3">
      <h2 id={titleId} className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {DECISION_TITLES[decision]}
      </h2>

      {decision === 'REJECT' ? (
        <div className="space-y-1">
          <label htmlFor="reason" className={labelClass}>
            Motivo
          </label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Confirma a aprovação desta solicitação?</p>
      )}

      <ErrorMessage message={error} />
      <DialogActions onClose={onClose} onConfirm={handleConfirm} isSubmitting={isSubmitting} />
    </div>
  )
}

export interface MarkPaidDialogProps {
  requestId: string
  onClose: () => void
  onSuccess: () => void
}

// Diálogo à parte: pagar exige data e referência, que aprovar/rejeitar não pedem.
export function MarkPaidDialog({ requestId, onClose, onSuccess }: MarkPaidDialogProps) {
  const titleId = useId()
  const [paidAt, setPaidAt] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const { error, setError, isSubmitting, submit } = useActionSubmit(onSuccess)

  const handleConfirm = () => {
    if (paidAt === '') {
      setError('Informe a data do pagamento')
      return
    }
    if (paymentReference.trim() === '') {
      setError('Informe a referência do pagamento')
      return
    }

    void submit(`/api/requests/${requestId}/mark-paid`, {
      paid_at: paidAt,
      payment_reference: paymentReference,
    })
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="space-y-3">
      <h2 id={titleId} className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        Marcar como paga
      </h2>

      <div className="space-y-1">
        <label htmlFor="paid_at" className={labelClass}>
          Data do pagamento
        </label>
        <input
          id="paid_at"
          type="date"
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="payment_reference" className={labelClass}>
          Referência do pagamento
        </label>
        <input
          id="payment_reference"
          type="text"
          value={paymentReference}
          onChange={(event) => setPaymentReference(event.target.value)}
          className={fieldClass}
        />
      </div>

      <ErrorMessage message={error} />
      <DialogActions onClose={onClose} onConfirm={handleConfirm} isSubmitting={isSubmitting} />
    </div>
  )
}
