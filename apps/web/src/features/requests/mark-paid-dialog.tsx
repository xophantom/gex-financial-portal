'use client'

import { useId, useState } from 'react'
import { DialogActions, DialogError } from '@/components/ui/dialog'
import { useActionSubmit } from './use-action-submit'

const fieldClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950'
const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'

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

      <DialogError message={error} />
      <DialogActions onClose={onClose} onConfirm={handleConfirm} isSubmitting={isSubmitting} />
    </div>
  )
}
