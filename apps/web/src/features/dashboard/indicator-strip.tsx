import type { DashboardSummaryResponse, RequestStatus } from '@gex/shared'
import { STATUS_STYLE } from '@/components/status/status-style'
import { formatBrl } from '@/lib/format/money'
import { cn } from '@/lib/utils'
import { monthLabel } from './action-summary'

interface Indicator {
  label: string
  value: string
  detail: string
  // Amostra de cor que liga o valor ao segmento da régua de status abaixo.
  status?: RequestStatus
  alert?: boolean
}

function indicators(summary: DashboardSummaryResponse): Indicator[] {
  const { status_counts: counts, overdue_count: overdue } = summary

  return [
    {
      label: 'Total pendente',
      value: formatBrl(summary.pending_amount_cents),
      detail: `${counts.PENDING} aguardando decisão`,
      status: 'PENDING',
    },
    {
      label: 'Total aprovado',
      value: formatBrl(summary.approved_amount_cents),
      detail: `${counts.APPROVED} aguardando pagamento`,
      status: 'APPROVED',
    },
    {
      label: 'Pago no mês',
      value: formatBrl(summary.paid_this_month_amount_cents),
      detail: `Em ${monthLabel(summary.reference_date)}`,
      status: 'PAID',
    },
    {
      label: 'Vencidas',
      value: String(overdue),
      detail: overdue > 0 ? 'Em aberto após o vencimento' : 'Nenhuma fora do prazo',
      alert: overdue > 0,
    },
  ]
}

// Os quatro indicadores numa única régua: uma superfície, divisórias finas e
// os valores em destaque tipográfico — em vez de quatro cartões iguais. No
// celular, cada indicador vira uma linha de extrato (rótulo à esquerda, valor
// à direita).
export function IndicatorStrip({ summary }: { summary: DashboardSummaryResponse }) {
  return (
    <dl className="grid divide-y divide-border overflow-hidden rounded-lg border bg-card shadow-xs lg:grid-cols-4 lg:divide-x lg:divide-y-0">
      {indicators(summary).map((item) => (
        <div
          key={item.label}
          className={cn(
            'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-5 py-4 lg:grid-cols-1 lg:gap-y-2.5 lg:px-6 lg:pt-5 lg:pb-6',
            item.alert && 'bg-pending-soft',
          )}
        >
          <dt className="col-start-1 row-start-1 flex items-center gap-2 text-sm font-medium">
            {item.status && (
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', STATUS_STYLE[item.status].fill)}
              />
            )}
            {item.label}
          </dt>
          <dd
            className={cn(
              'col-start-2 row-span-2 row-start-1 self-center text-right font-heading text-xl font-semibold tracking-tight tabular-nums',
              'lg:col-start-1 lg:row-span-1 lg:row-start-2 lg:text-left lg:text-[1.75rem] lg:leading-none',
              item.alert && 'text-pending',
            )}
          >
            {item.value}
          </dd>
          <dd
            className={cn(
              'col-start-1 row-start-2 text-xs text-muted-foreground lg:row-start-3',
              item.alert && 'font-medium text-pending',
            )}
          >
            {item.detail}
          </dd>
        </div>
      ))}
    </dl>
  )
}
