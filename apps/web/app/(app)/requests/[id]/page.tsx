import { notFound } from 'next/navigation'
import { RequestDetail, type RequestAction, type RequestDetailData } from '@/components/request-detail'
import type { StatusEvent } from '@/components/status-timeline'
import { ApiError, apiFetch } from '@/lib/api-client'

// Forma de GET /requests/:id (apps/api/src/requests/requests.service.ts
// findOne()) — mesma nota de dashboard/page.tsx: sem contrato HTTP
// compartilhado entre apps/web e apps/api, só @gex/shared (regras de domínio).
interface RequestDetailResponse {
  request: RequestDetailData
  history: StatusEvent[]
  allowed_actions: RequestAction[]
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let detail: RequestDetailResponse
  try {
    detail = await apiFetch<RequestDetailResponse>(`/requests/${id}`)
  } catch (error) {
    // 404 tanto para "não existe" quanto para "existe mas não é meu" — o
    // backend devolve o mesmo código nos dois casos de propósito (não
    // confirmar a existência de um registro alheio a quem não pode vê-lo).
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        Solicitação · {detail.request.invoice_number}
      </h1>
      <div className="mt-6">
        <RequestDetail
          request={detail.request}
          history={detail.history}
          allowedActions={detail.allowed_actions}
        />
      </div>
    </main>
  )
}
