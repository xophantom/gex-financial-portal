import type { RequestDetailResponse } from '@gex/shared'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RequestDetail } from '@/features/requests/request-detail'
import { ApiError, apiFetchForPage } from '@/lib/api/client'

export const metadata: Metadata = { title: 'Solicitação' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Um id que nem é UUID não pode existir: 404 direto, sem ida à API.
  if (!UUID.test(id)) notFound()

  let detail: RequestDetailResponse
  try {
    detail = await apiFetchForPage<RequestDetailResponse>(`/requests/${id}`)
  } catch (error) {
    // 404 tanto para "não existe" quanto para "existe mas não é meu" — o
    // backend devolve o mesmo código nos dois casos de propósito (não
    // confirmar a existência de um registro alheio a quem não pode vê-lo).
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <Link
        href="/requests"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Voltar para solicitações
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
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
