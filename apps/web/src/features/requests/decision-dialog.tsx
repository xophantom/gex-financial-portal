'use client'

import type { DecisionInput } from '@gex/shared'
import { useState } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ActionDialog } from './action-dialog'
import { useActionSubmit } from './use-action-submit'

type Decision = DecisionInput['decision']

export interface DecisionDialogProps {
  requestId: string
  supplierName: string
  decision: Decision
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// A decisão é fixa por diálogo: o servidor já definiu, via allowed_actions,
// quais botões existem.
export function DecisionDialog({
  requestId,
  supplierName,
  decision,
  open,
  onOpenChange,
  onSuccess,
}: DecisionDialogProps) {
  const [reason, setReason] = useState('')
  // Erro de preenchimento fica no campo; o erro da API, no alerta do diálogo.
  const [reasonError, setReasonError] = useState<string | null>(null)
  const { error, isSubmitting, submit } = useActionSubmit(onSuccess)
  const isReject = decision === 'REJECT'

  const handleConfirm = () => {
    if (isReject && reason.trim() === '') {
      setReasonError('Informe o motivo da rejeição.')
      return
    }

    void submit(`/api/requests/${requestId}/decision`, {
      decision,
      reason: isReject ? reason : undefined,
    })
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isReject ? 'Rejeitar solicitação' : 'Aprovar solicitação'}
      description={
        isReject
          ? `A solicitação de ${supplierName} será encerrada. O motivo fica no histórico e o solicitante vê.`
          : `A solicitação de ${supplierName} fica liberada para pagamento.`
      }
      confirmLabel={isReject ? 'Rejeitar' : 'Aprovar'}
      tone={isReject ? 'reject' : 'approve'}
      error={error}
      isSubmitting={isSubmitting}
      onConfirm={handleConfirm}
    >
      {isReject && (
        <Field data-invalid={Boolean(reasonError) || undefined}>
          <FieldLabel htmlFor="reason">Motivo</FieldLabel>
          <Textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setReasonError(null)
            }}
            aria-invalid={Boolean(reasonError) || undefined}
            aria-describedby={reasonError ? 'reason-hint reason-error' : 'reason-hint'}
          />
          <FieldDescription id="reason-hint">
            Ex.: nota emitida com CNPJ de outra filial.
          </FieldDescription>
          {reasonError && <FieldError id="reason-error">{reasonError}</FieldError>}
        </Field>
      )}
    </ActionDialog>
  )
}
