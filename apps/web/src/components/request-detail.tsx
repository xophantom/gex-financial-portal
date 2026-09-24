'use client'

import {
  formatCentsToBrl,
  formatCnpj,
  formatCompetence,
  type RequestAction,
  type RequestStatus,
} from '@gex/shared'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { formatCalendarDate, formatDate } from '@/format/dates'
import { useUiStore } from '@/stores/ui-store'
import { DecisionDialog, MarkPaidDialog } from './decision-dialog'
import { StatusBadge } from './status-badge'
import { StatusTimeline, type StatusEvent } from './status-timeline'

export type { RequestAction }

// GET /requests/:id — só os campos que esta tela usa.
export interface RequestDetailData {
  id: string
  supplier_name: string
  supplier_cnpj: string
  invoice_number: string
  amount_cents: number
  competence: string
  due_date: string
  category: string
  description: string | null
  status: RequestStatus
  rejection_reason: string | null
  paid_at: string | null
  payment_reference: string | null
  is_overdue: boolean
  requester: { id: string; name: string }
}

const SUCCESS_MESSAGE: Record<RequestAction, string> = {
  APPROVE: 'Solicitação aprovada com sucesso.',
  REJECT: 'Solicitação rejeitada.',
  MARK_PAID: 'Solicitação marcada como paga.',
}

// Os botões dependem só de allowedActions (calculado pelo backend), nunca do
// papel do usuário: uma segunda regra no cliente poderia divergir.
export function RequestDetail({
  request,
  history,
  allowedActions,
}: {
  request: RequestDetailData
  history: StatusEvent[]
  allowedActions: RequestAction[]
}) {
  const router = useRouter()
  const openDialog = useUiStore((state) => state.openDialog)
  const setOpenDialog = useUiStore((state) => state.setOpenDialog)
  const pushToast = useUiStore((state) => state.pushToast)

  const closeDialog = useCallback(() => setOpenDialog(null), [setOpenDialog])

  // A store sobrevive à navegação: sem isto, um diálogo deixado aberto
  // reapareceria ao abrir outra solicitação.
  useEffect(() => closeDialog, [closeDialog])

  const handleSuccess = (action: RequestAction) => {
    closeDialog()
    pushToast({ message: SUCCESS_MESSAGE[action], tone: 'success' })
    // Reexecuta o Server Component da rota: status, ações e histórico novos.
    router.refresh()
  }

  const canApprove = allowedActions.includes('APPROVE')
  const canReject = allowedActions.includes('REJECT')
  const canMarkPaid = allowedActions.includes('MARK_PAID')
  const hasActions = canApprove || canReject || canMarkPaid

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800">
        <Field label="Fornecedor" value={request.supplier_name} />
        <Field label="CNPJ" value={formatCnpj(request.supplier_cnpj)} />
        <Field label="Número da nota" value={request.invoice_number} />
        <Field label="Valor" value={`R$ ${formatCentsToBrl(request.amount_cents)}`} />
        <Field label="Competência" value={formatCompetence(request.competence)} />
        <Field label="Vencimento" value={formatCalendarDate(request.due_date)} />
        <Field label="Categoria" value={request.category} />
        <Field label="Status" value={<StatusBadge status={request.status} />} />
        <Field label="Solicitante" value={request.requester.name} />
        {request.is_overdue && <Field label="Situação" value="Vencida" />}
        {request.description && <Field label="Descrição" value={request.description} />}
        {request.rejection_reason && (
          <Field label="Motivo da rejeição" value={request.rejection_reason} />
        )}
        {/* paid_at é um instante (meio-dia de SP); a hora não tem significado. */}
        {request.paid_at && <Field label="Pago em" value={formatDate(request.paid_at)} />}
        {request.payment_reference && (
          <Field label="Referência do pagamento" value={request.payment_reference} />
        )}
      </dl>

      {hasActions && (
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <button
              type="button"
              onClick={() => setOpenDialog('APPROVE')}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Aprovar
            </button>
          )}
          {canReject && (
            <button
              type="button"
              onClick={() => setOpenDialog('REJECT')}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Rejeitar
            </button>
          )}
          {canMarkPaid && (
            <button
              type="button"
              onClick={() => setOpenDialog('MARK_PAID')}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Marcar como paga
            </button>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">
          Histórico
        </h2>
        <StatusTimeline events={history} />
      </section>

      {openDialog === 'APPROVE' && (
        <DialogOverlay onClose={closeDialog}>
          <DecisionDialog
            requestId={request.id}
            decision="APPROVE"
            onClose={closeDialog}
            onSuccess={() => handleSuccess('APPROVE')}
          />
        </DialogOverlay>
      )}
      {openDialog === 'REJECT' && (
        <DialogOverlay onClose={closeDialog}>
          <DecisionDialog
            requestId={request.id}
            decision="REJECT"
            onClose={closeDialog}
            onSuccess={() => handleSuccess('REJECT')}
          />
        </DialogOverlay>
      )}
      {openDialog === 'MARK_PAID' && (
        <DialogOverlay onClose={closeDialog}>
          <MarkPaidDialog
            requestId={request.id}
            onClose={closeDialog}
            onSuccess={() => handleSuccess('MARK_PAID')}
          />
        </DialogOverlay>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  )
}

function DialogOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // Foco inicial no primeiro campo (ou em "Cancelar", ao aprovar); ao fechar,
    // volta para o botão que abriu o diálogo.
    panelRef.current?.querySelector<HTMLElement>('textarea, input, select, button')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      opener?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div ref={panelRef} className="relative z-10 w-full max-w-md rounded-lg bg-white p-4 shadow-xl dark:bg-zinc-900">
        {children}
      </div>
    </div>
  )
}
