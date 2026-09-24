'use client'

import { formatCentsToBrl, formatCnpj, formatCompetence } from '@gex/shared'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useUiStore } from '@/stores/ui-store'
import { DecisionDialog, MarkPaidDialog } from './decision-dialog'
import { StatusBadge } from './status-badge'
import { formatDateTime, StatusTimeline, type StatusEvent } from './status-timeline'

// Forma de GET /requests/:id (apps/api/src/requests/requests.service.ts
// toResponse()) — como em requests-table.tsx, só os campos que esta tela usa.
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
  rejection_reason: string | null
  paid_at: string | null
  payment_reference: string | null
  is_overdue: boolean
  requester: { id: string; name: string }
}

export type RequestAction = 'APPROVE' | 'REJECT' | 'MARK_PAID'

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

const SUCCESS_MESSAGE: Record<RequestAction, string> = {
  APPROVE: 'Solicitação aprovada com sucesso.',
  REJECT: 'Solicitação rejeitada.',
  MARK_PAID: 'Solicitação marcada como paga.',
}

// allowedActions é tudo que decide quais botões existem — nunca o papel do
// usuário logado. O backend já filtrou isso em allowedActionsFor() antes de
// a resposta chegar aqui; repetir a checagem por papel no cliente seria uma
// segunda fonte de verdade que pode divergir da primeira.
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

  const handleSuccess = (action: RequestAction) => {
    setOpenDialog(null)
    pushToast({ message: SUCCESS_MESSAGE[action], tone: 'success' })
    // Não há cache de cliente para invalidar: todo Server Component chama a
    // API com cache: 'no-store'. refresh() só precisa reexecutar o Server
    // Component desta rota para trazer status, allowed_actions e histórico
    // atualizados, sem recarregar a página inteira.
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
        <Field label="Vencimento" value={formatIsoDate(request.due_date)} />
        <Field label="Categoria" value={request.category} />
        <Field label="Status" value={<StatusBadge status={request.status} />} />
        <Field label="Solicitante" value={request.requester.name} />
        {request.is_overdue && <Field label="Situação" value="Vencida" />}
        {request.description && <Field label="Descrição" value={request.description} />}
        {request.rejection_reason && (
          <Field label="Motivo da rejeição" value={request.rejection_reason} />
        )}
        {request.paid_at && <Field label="Pago em" value={formatDateTime(request.paid_at)} />}
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
        <DialogOverlay onClose={() => setOpenDialog(null)}>
          <DecisionDialog
            requestId={request.id}
            decision="APPROVE"
            onClose={() => setOpenDialog(null)}
            onSuccess={() => handleSuccess('APPROVE')}
          />
        </DialogOverlay>
      )}
      {openDialog === 'REJECT' && (
        <DialogOverlay onClose={() => setOpenDialog(null)}>
          <DecisionDialog
            requestId={request.id}
            decision="REJECT"
            onClose={() => setOpenDialog(null)}
            onSuccess={() => handleSuccess('REJECT')}
          />
        </DialogOverlay>
      )}
      {openDialog === 'MARK_PAID' && (
        <DialogOverlay onClose={() => setOpenDialog(null)}>
          <MarkPaidDialog
            requestId={request.id}
            onClose={() => setOpenDialog(null)}
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
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-4 shadow-xl dark:bg-zinc-900">
        {children}
      </div>
    </div>
  )
}
