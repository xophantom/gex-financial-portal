'use client'

import type { DecisionInput } from '@gex/shared'
import { useId, useState } from 'react'
import { DialogActions, DialogError } from '@/components/ui/dialog'
import { useActionSubmit } from './use-action-submit'

type Decision = DecisionInput['decision']

const DECISION_TITLES: Record<Decision, string> = {
  APPROVE: 'Aprovar solicitação',
  REJECT: 'Rejeitar solicitação',
}

const fieldClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950'
const labelClass = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200'

export interface DecisionDialogProps {
  requestId: string
  decision: Decision
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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Confirma a aprovação desta solicitação?
        </p>
      )}

      <DialogError message={error} />
      <DialogActions onClose={onClose} onConfirm={handleConfirm} isSubmitting={isSubmitting} />
    </div>
  )
}
