import type { DashboardSummaryResponse, RequestListResponse } from '@gex/shared'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DashboardSkeleton } from '@/features/dashboard/dashboard-skeleton'
import { DashboardSummary } from '@/features/dashboard/dashboard-summary'
import { apiFetchForPage } from '@/lib/api/client'
import { getSessionUser } from '@/lib/session/user'

export const metadata: Metadata = { title: 'Visão geral' }

export default function DashboardPage() {
  // O Suspense é o ponto do streaming: a casca (sidebar e título) chega ao
  // browser sem esperar a API, e o resumo substitui o esqueleto assim que o
  // resumo e as pendentes chegam.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Summary />
    </Suspense>
  )
}

async function Summary() {
  const [user, summary, pending] = await Promise.all([
    getSessionUser(),
    apiFetchForPage<DashboardSummaryResponse>('/dashboard/summary'),
    apiFetchForPage<RequestListResponse>('/requests?status=PENDING&page_size=5'),
  ])

  return <DashboardSummary summary={summary} pending={pending} role={user.role} />
}
