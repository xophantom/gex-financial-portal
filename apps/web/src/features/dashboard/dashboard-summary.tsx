import type { DashboardSummaryResponse, RequestListResponse, UserRole } from '@gex/shared'
import { FilePlus2, Inbox } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { formatCalendarDate } from '@/lib/format/dates'
import { actionSummary } from './action-summary'
import { AttentionList } from './attention-list'
import { IndicatorStrip } from './indicator-strip'
import { StatusDistribution } from './status-distribution'

export const DASHBOARD_TITLE = 'Visão geral'

// Data da posição, discreta, no canto das ações do cabeçalho.
function ReferenceDate({ isoDate }: { isoDate: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Posição em <time dateTime={isoDate}>{formatCalendarDate(isoDate)}</time>
    </p>
  )
}

export function DashboardSummary({
  summary,
  pending,
  role,
}: {
  summary: DashboardSummaryResponse
  pending: RequestListResponse
  role: UserRole
}) {
  if (summary.request_count === 0) {
    return (
      <>
        <PageHeader
          title={DASHBOARD_TITLE}
          actions={<ReferenceDate isoDate={summary.reference_date} />}
        />
        <DashboardEmpty role={role} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={DASHBOARD_TITLE}
        description={actionSummary(summary, role)}
        actions={<ReferenceDate isoDate={summary.reference_date} />}
      />
      <div className="space-y-6">
        <IndicatorStrip summary={summary} />
        <StatusDistribution counts={summary.status_counts} total={summary.request_count} />
        <AttentionList pending={pending} role={role} />
      </div>
    </>
  )
}

function DashboardEmpty({ role }: { role: UserRole }) {
  const isRequester = role === 'REQUESTER'

  return (
    <Empty className="border bg-card py-16 shadow-xs">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-semibold">
          {isRequester ? 'Você ainda não tem solicitações' : 'Nenhuma solicitação recebida'}
        </EmptyTitle>
        <EmptyDescription>
          {isRequester
            ? 'Cadastre a primeira nota fiscal de um fornecedor. Os totais e o andamento aparecem aqui assim que ela for enviada.'
            : 'Quando um solicitante cadastrar uma nota fiscal, os totais e o que aguarda decisão aparecem aqui.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {isRequester ? (
          <Button asChild size="lg">
            <Link href="/requests/new">
              <FilePlus2 />
              Cadastrar solicitação
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline">
            <Link href="/requests">Abrir solicitações</Link>
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
