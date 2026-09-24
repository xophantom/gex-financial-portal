'use client'

import { markPaidSchema, PAYMENT_REFERENCE_MAX_LENGTH } from '@gex/shared'
import { useState } from 'react'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatCalendarDate } from '@/lib/format/dates'
import { ActionDialog } from './action-dialog'
import { fieldErrorsFrom, issuesAsDetails, useActionSubmit } from './use-action-submit'

const FIELDS = ['paid_at', 'payment_reference'] as const

export interface MarkPaidDialogProps {
  requestId: string
  supplierName: string
  // "Hoje" para a API (APP_TODAY, quando definida): o padrão e o limite do
  // campo, já que o relógio do navegador pode estar em outro dia.
  referenceDate: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Diálogo à parte: pagar exige data e referência, que aprovar/rejeitar não pedem.
export function MarkPaidDialog({
  requestId,
  supplierName,
  referenceDate,
  open,
  onOpenChange,
  onSuccess,
}: MarkPaidDialogProps) {
  const [paidAt, setPaidAt] = useState(referenceDate)
  const [paymentReference, setPaymentReference] = useState('')
  const { error, fieldErrors, setFieldErrors, clearFieldError, isSubmitting, submit } =
    useActionSubmit(FIELDS, onSuccess)

  const handleConfirm = () => {
    // O input de data vazio vale '': como ausente, o schema pede a data em
    // vez de reclamar do formato.
    const parsed = markPaidSchema.safeParse({
      paid_at: paidAt || undefined,
      payment_reference: paymentReference,
    })
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(FIELDS, issuesAsDetails(parsed.error.issues)))
      return
    }

    void submit(`/api/requests/${requestId}/mark-paid`, parsed.data)
  }

  const describedBy = (name: (typeof FIELDS)[number], hint?: string) =>
    [hint, fieldErrors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined

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
            max={referenceDate}
            onChange={(event) => {
              setPaidAt(event.target.value)
              clearFieldError('paid_at')
            }}
            aria-invalid={Boolean(fieldErrors.paid_at) || undefined}
            aria-describedby={describedBy('paid_at', 'paid_at-hint')}
          />
          <FieldDescription id="paid_at-hint">
            Até hoje, {formatCalendarDate(referenceDate)}.
          </FieldDescription>
          {fieldErrors.paid_at && <FieldError id="paid_at-error">{fieldErrors.paid_at}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(fieldErrors.payment_reference) || undefined}>
          <FieldLabel htmlFor="payment_reference">Referência do pagamento</FieldLabel>
          <Input
            id="payment_reference"
            placeholder="Ex.: TED 000123 ou ID do Pix"
            maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
            value={paymentReference}
            onChange={(event) => {
              setPaymentReference(event.target.value)
              clearFieldError('payment_reference')
            }}
            aria-invalid={Boolean(fieldErrors.payment_reference) || undefined}
            aria-describedby={describedBy('payment_reference')}
          />
          {fieldErrors.payment_reference && (
            <FieldError id="payment_reference-error">{fieldErrors.payment_reference}</FieldError>
          )}
        </Field>
      </FieldGroup>
    </ActionDialog>
  )
}
