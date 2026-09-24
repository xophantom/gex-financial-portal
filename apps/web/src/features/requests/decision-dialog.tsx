'use client'

import { DECISION_REASON_MAX_LENGTH, decisionSchema, type DecisionInput } from '@gex/shared'
import { useState } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ActionDialog } from './action-dialog'
import { fieldErrorsFrom, issuesAsDetails, useActionSubmit } from './use-action-submit'

type Decision = DecisionInput['decision']

const FIELDS = ['reason'] as const

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
  const { error, fieldErrors, setFieldErrors, clearFieldError, isSubmitting, submit } =
    useActionSubmit(FIELDS, onSuccess)
  const isReject = decision === 'REJECT'

  const handleConfirm = () => {
    // O mesmo schema que a API aplica: a regra do motivo mora num lugar só.
    const parsed = decisionSchema.safeParse({ decision, reason })
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(FIELDS, issuesAsDetails(parsed.error.issues)))
      return
    }

    void submit(`/api/requests/${requestId}/decision`, parsed.data)
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
      <Field data-invalid={Boolean(fieldErrors.reason) || undefined}>
        <FieldLabel htmlFor="reason">{isReject ? 'Motivo' : 'Observação (opcional)'}</FieldLabel>
        <Textarea
          id="reason"
          rows={3}
          maxLength={DECISION_REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            clearFieldError('reason')
          }}
          aria-invalid={Boolean(fieldErrors.reason) || undefined}
          aria-describedby={fieldErrors.reason ? 'reason-hint reason-error' : 'reason-hint'}
        />
        <FieldDescription id="reason-hint">
          {isReject
            ? 'Ex.: nota emitida com CNPJ de outra filial.'
            : 'Fica registrada no histórico da solicitação.'}
        </FieldDescription>
        {fieldErrors.reason && <FieldError id="reason-error">{fieldErrors.reason}</FieldError>}
      </Field>
    </ActionDialog>
  )
}
