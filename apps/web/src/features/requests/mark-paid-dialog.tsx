'use client'

import { useState } from 'react'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ActionDialog } from './action-dialog'
import { useActionSubmit } from './use-action-submit'

export interface MarkPaidDialogProps {
  requestId: string
  supplierName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FieldErrors = Partial<Record<'paid_at' | 'payment_reference', string>>

// Diálogo à parte: pagar exige data e referência, que aprovar/rejeitar não pedem.
export function MarkPaidDialog({
  requestId,
  supplierName,
  open,
  onOpenChange,
  onSuccess,
}: MarkPaidDialogProps) {
  const [paidAt, setPaidAt] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  // Erros de preenchimento ficam em cada campo; o erro da API, no alerta.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const { error, isSubmitting, submit } = useActionSubmit(onSuccess)

  const handleConfirm = () => {
    const errors: FieldErrors = {}
    if (paidAt === '') errors.paid_at = 'Informe a data do pagamento.'
    if (paymentReference.trim() === '')
      errors.payment_reference = 'Informe a referência do pagamento.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    void submit(`/api/requests/${requestId}/mark-paid`, {
      paid_at: paidAt,
      payment_reference: paymentReference,
    })
  }

  const invalidProps = (name: keyof FieldErrors) =>
    fieldErrors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pagamento"
      description={`Informe quando e como ${supplierName} foi pago.`}
      confirmLabel="Registrar pagamento"
      tone="pay"
      error={error}
      isSubmitting={isSubmitting}
      onConfirm={handleConfirm}
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(fieldErrors.paid_at) || undefined}>
          <FieldLabel htmlFor="paid_at">Data do pagamento</FieldLabel>
          <Input
            id="paid_at"
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
            {...invalidProps('paid_at')}
          />
          {fieldErrors.paid_at && <FieldError id="paid_at-error">{fieldErrors.paid_at}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(fieldErrors.payment_reference) || undefined}>
          <FieldLabel htmlFor="payment_reference">Referência do pagamento</FieldLabel>
          <Input
            id="payment_reference"
            placeholder="Ex.: TED 000123 ou ID do Pix"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            {...invalidProps('payment_reference')}
          />
          {fieldErrors.payment_reference && (
            <FieldError id="payment_reference-error">{fieldErrors.payment_reference}</FieldError>
          )}
        </Field>
      </FieldGroup>
    </ActionDialog>
  )
}
