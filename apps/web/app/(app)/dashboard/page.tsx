import { Suspense } from 'react'
import { SummaryCard } from '@/components/summary-card'
import { apiFetch } from '@/lib/api-client'

// Forma de GET /dashboard/summary (apps/api/src/dashboard/dashboard.service.ts).
// Duplicada aqui em vez de importada da API porque apps/web e apps/api não
// compartilham um pacote de contratos HTTP — só @gex/shared (regras de
// domínio puras), que não é o lugar certo para a forma de uma resposta.
interface DashboardSummary {
  reference_date: string
  pending_amount_cents: number
  approved_amount_cents: number
  paid_this_month_amount_cents: number
  overdue_count: number
  request_count: number
  status_counts: {
    PENDING: number
    APPROVED: number
    REJECTED: number
    PAID: number
  }
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Visão geral</h1>
      <div className="mt-6">
        {/* O Suspense é o ponto do streaming: a casca da página (h1, nav já
            renderizado pelo layout) chega ao browser sem esperar a rede da
            API, e o grid substitui o skeleton assim que /dashboard/summary
            resolve — ver Task 18 brief, "Streaming e velocidade percebida". */}
        <Suspense fallback={<SummarySkeleton />}>
          <SummaryGrid />
        </Suspense>
      </div>
    </main>
  )
}

async function SummaryGrid() {
  // apiFetch é o único caminho para a API: ele injeta o Bearer do cookie
  // httpOnly, gera e propaga x-correlation-id e coalesce o refresh de 401 —
  // nenhuma dessas garantias é real até este componente existir (Task 18
  // brief, "Context the brief cannot know").
  const summary = await apiFetch<DashboardSummary>('/dashboard/summary')

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Total pendente" valueCents={summary.pending_amount_cents} />
      <SummaryCard label="Total aprovado" valueCents={summary.approved_amount_cents} />
      <SummaryCard label="Pago no mês" valueCents={summary.paid_this_month_amount_cents} />
      <SummaryCard
        label="Vencidas"
        count={summary.overdue_count}
        tone={summary.overdue_count > 0 ? 'warning' : 'default'}
      />
    </div>
  )
}

function SummarySkeleton() {
  // role="status" + texto sr-only: leitor de tela anuncia "carregando", sem
  // depender só do efeito visual. Os quatro blocos pulsantes (mesma altura
  // final dos cartões reais) evitam tanto a área em branco quanto o layout
  // shift quando o Suspense resolve.
  return (
    <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <span className="sr-only">Carregando indicadores...</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </div>
  )
}
