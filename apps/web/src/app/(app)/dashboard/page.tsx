import type { DashboardSummaryResponse } from '@gex/shared'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SummaryCard } from '@/features/dashboard/summary-card'
import { apiFetchForPage } from '@/lib/api/client'
import { formatCalendarDate } from '@/lib/format/dates'

export const metadata: Metadata = { title: 'Visão geral' }

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Visão geral</h1>
      {/* O Suspense é o ponto do streaming: a casca da página chega ao
          browser sem esperar a API, e o grid substitui o skeleton assim que
          /dashboard/summary resolve. */}
      <Suspense fallback={<SummarySkeleton />}>
        <SummaryGrid />
      </Suspense>
    </main>
  )
}

async function SummaryGrid() {
  const summary = await apiFetchForPage<DashboardSummaryResponse>('/dashboard/summary')

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Referência: {formatCalendarDate(summary.reference_date)}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total pendente" valueCents={summary.pending_amount_cents} />
        <SummaryCard label="Total aprovado" valueCents={summary.approved_amount_cents} />
        <SummaryCard label="Pago no mês" valueCents={summary.paid_this_month_amount_cents} />
        <SummaryCard
          label="Vencidas"
          count={summary.overdue_count}
          tone={summary.overdue_count > 0 ? 'warning' : 'default'}
        />
      </div>
    </>
  )
}

function SummarySkeleton() {
  // role="status" + texto sr-only: leitor de tela anuncia "carregando", sem
  // depender só do efeito visual. Os blocos têm a altura final dos cartões
  // reais para evitar layout shift quando o Suspense resolve.
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando indicadores...</span>
      <div aria-hidden="true" className="mt-1 h-5 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  )
}
