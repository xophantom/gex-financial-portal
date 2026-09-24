'use client'

import { useState } from 'react'

const DECISION_TITLES: Record<'APPROVE' | 'REJECT', string> = {
  APPROVE: 'Aprovar solicitação',
  REJECT: 'Rejeitar solicitação',
}

export interface DecisionDialogProps {
  requestId: string
  decision: 'APPROVE' | 'REJECT'
  onClose: () => void
  onSuccess: () => void
}

// Um diálogo por decisão fixa (Aprovar abre com decision="APPROVE", Rejeitar
// com decision="REJECT") em vez de deixar o usuário escolher a decisão
// dentro do diálogo — mais simples de testar e o servidor já decidiu, via
// allowed_actions, quais dos dois botões podem existir.
export function DecisionDialog({ requestId, decision, onClose, onSuccess }: DecisionDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (decision === 'REJECT' && reason.trim() === '') {
      setError('Informe o motivo da rejeição')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/requests/${requestId}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: decision === 'REJECT' ? reason : undefined }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        setError(body?.error?.message ?? 'Erro inesperado')
        return
      }

      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={DECISION_TITLES[decision]} className="space-y-3">
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {DECISION_TITLES[decision]}
      </h2>

      {decision === 'REJECT' && (
        <div className="space-y-1">
          <label htmlFor="reason" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Motivo
          </label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

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
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}

export interface MarkPaidDialogProps {
  requestId: string
  onClose: () => void
  onSuccess: () => void
}

// Pagar exige duas informações que aprovar/rejeitar não pedem — data e
// referência do pagamento — por isso é um diálogo à parte, não mais um
// `decision` possível de DecisionDialog.
export function MarkPaidDialog({ requestId, onClose, onSuccess }: MarkPaidDialogProps) {
  const [paidAt, setPaidAt] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (paidAt.trim() === '') {
      setError('Informe a data do pagamento')
      return
    }
    if (paymentReference.trim() === '') {
      setError('Informe a referência do pagamento')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/requests/${requestId}/mark-paid`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paid_at: paidAt, payment_reference: paymentReference }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        setError(body?.error?.message ?? 'Erro inesperado')
        return
      }

      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Marcar como paga" className="space-y-3">
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Marcar como paga</h2>

      <div className="space-y-1">
        <label htmlFor="paid_at" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Data do pagamento
        </label>
        <input
          id="paid_at"
          type="date"
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="payment_reference" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Referência do pagamento
        </label>
        <input
          id="payment_reference"
          type="text"
          value={paymentReference}
          onChange={(event) => setPaymentReference(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

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
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}
