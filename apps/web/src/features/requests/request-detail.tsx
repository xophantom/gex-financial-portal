'use client'

import {
  formatCompetence,
  type RequestAction,
  type RequestResponse,
  type StatusEventResponse,
} from '@gex/shared'
import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatCalendarDate, formatDate } from '@/lib/format/dates'
import { categoryLabel } from '@/lib/format/labels'
import { formatBrl } from '@/lib/format/money'
import { cn } from '@/lib/utils'
import { DecisionDialog } from './decision-dialog'
import { MarkPaidDialog } from './mark-paid-dialog'
import { StatusStamp } from './status-stamp'
import { StatusTimeline } from './status-timeline'

// O toast repete o verbo do botão que o usuário acabou de apertar.
const SUCCESS_MESSAGE: Record<RequestAction, string> = {
  APPROVE: 'Solicitação aprovada.',
  REJECT: 'Solicitação rejeitada.',
  MARK_PAID: 'Pagamento registrado.',
}

// Uma linha sobre o que falta acontecer, acima dos botões de ação.
const NEXT_STEP: Partial<Record<RequestResponse['status'], string>> = {
  PENDING: 'Aguardando aprovação do financeiro.',
  APPROVED: 'Aprovada e aguardando pagamento.',
}

// Os botões dependem só de allowedActions (calculado pelo backend), nunca do
// papel do usuário: uma segunda regra no cliente poderia divergir.
export function RequestDetail({
  request,
  history,
  allowedActions,
}: {
  request: RequestResponse
  history: StatusEventResponse[]
  allowedActions: RequestAction[]
}) {
  const router = useRouter()
  const [openDialog, setOpenDialog] = useState<RequestAction | null>(null)

  const closeDialog = () => setOpenDialog(null)

  const handleSuccess = (action: RequestAction) => {
    closeDialog()
    toast.success(SUCCESS_MESSAGE[action])
    // Reexecuta o Server Component da rota: status, ações e histórico novos.
    router.refresh()
  }

  const canApprove = allowedActions.includes('APPROVE')
  const canReject = allowedActions.includes('REJECT')
  const canMarkPaid = allowedActions.includes('MARK_PAID')
  const hasActions = canApprove || canReject || canMarkPaid

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] xl:gap-14">
      <article
        aria-label="Dados da solicitação"
        className="relative overflow-hidden rounded-lg border bg-card shadow-xs"
      >
        <div className="px-5 pt-6 pb-7 sm:px-8 sm:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="mt-1 font-heading text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
                {formatBrl(request.amount_cents)}
              </p>
            </div>
            <StatusStamp
              status={request.status}
              date={stampDate(request, history)}
              className="mt-1 mr-1 ml-auto sm:mt-2 sm:mr-2"
            />
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-7 sm:grid-cols-3">
            <DataItem label="Competência">{formatCompetence(request.competence)}</DataItem>
            <DataItem label="Vencimento">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {formatCalendarDate(request.due_date)}
                {request.is_overdue && (
                  <span className="rounded-sm bg-pending-soft px-1.5 py-px text-xs font-semibold text-pending">
                    Vencida
                  </span>
                )}
              </span>
            </DataItem>
            <DataItem label="Categoria">{categoryLabel(request.category)}</DataItem>
            <DataItem label="Solicitante">{request.requester.name}</DataItem>
            {/* paid_at é um instante (meio-dia de SP); a hora não tem significado. */}
            {request.paid_at && <DataItem label="Pago em">{formatDate(request.paid_at)}</DataItem>}
            {request.payment_reference && (
              <DataItem label="Referência do pagamento" className="wrap-break-word">
                {request.payment_reference}
              </DataItem>
            )}
            <DataItem label="Descrição" className="col-span-full">
              {request.description ? (
                <span className="max-w-prose whitespace-pre-line">{request.description}</span>
              ) : (
                <span className="text-muted-foreground">Sem descrição.</span>
              )}
            </DataItem>
          </dl>

          {request.rejection_reason && (
            <div className="mt-7 rounded-md bg-rejected-soft px-4 py-3.5">
              <p className="text-sm font-semibold text-rejected">Motivo da rejeição</p>
              <p className="mt-1 max-w-prose text-[0.9375rem] whitespace-pre-line text-foreground">
                {request.rejection_reason}
              </p>
            </div>
          )}
        </div>

        {hasActions && (
          <div className="flex flex-col gap-3 border-t bg-muted/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-muted-foreground">
              {NEXT_STEP[request.status] ?? 'Escolha o próximo passo.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {canReject && (
                <Button variant="outline" size="lg" onClick={() => setOpenDialog('REJECT')}>
                  <X aria-hidden="true" />
                  Rejeitar
                </Button>
              )}
              {canApprove && (
                <Button size="lg" onClick={() => setOpenDialog('APPROVE')}>
                  <Check aria-hidden="true" />
                  Aprovar
                </Button>
              )}
              {canMarkPaid && (
                <Button
                  size="lg"
                  className="bg-paid text-white hover:bg-paid/90"
                  onClick={() => setOpenDialog('MARK_PAID')}
                >
                  Registrar pagamento
                </Button>
              )}
            </div>
          </div>
        )}
      </article>

      <section aria-labelledby="history-heading" className="lg:pt-2">
        <h2 id="history-heading" className="mb-5 text-lg font-semibold text-foreground">
          Histórico
        </h2>
        <StatusTimeline events={history} />
      </section>

      {(openDialog === 'APPROVE' || openDialog === 'REJECT') && (
        <DecisionDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          requestId={request.id}
          supplierName={request.supplier_name}
          decision={openDialog}
          onSuccess={() => handleSuccess(openDialog)}
        />
      )}
      {openDialog === 'MARK_PAID' && (
        <MarkPaidDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          requestId={request.id}
          supplierName={request.supplier_name}
          onSuccess={() => handleSuccess('MARK_PAID')}
        />
      )}
    </div>
  )
}

// Data impressa no carimbo: o pagamento efetivo, quando pago; senão, o
// evento mais recente que levou ao status atual.
function stampDate(request: RequestResponse, history: StatusEventResponse[]): string | null {
  if (request.status === 'PAID' && request.paid_at) return formatDate(request.paid_at)
  const event = history.findLast((item) => item.new_status === request.status)
  return event ? formatDate(event.created_at) : null
}

function DataItem({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[0.9375rem] font-medium text-foreground">{children}</dd>
    </div>
  )
}
