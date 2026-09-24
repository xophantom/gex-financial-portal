import { formatCnpj, type RequestDetailResponse } from '@gex/shared'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
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

  const { request } = detail

  return (
    <>
      <Link
        href="/requests"
        className="-ml-1 mb-4 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Solicitações
      </Link>
      <PageHeader
        title={request.supplier_name}
        description={
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            <span>
              Nota fiscal{' '}
              <span className="font-medium text-foreground">{request.invoice_number}</span>
            </span>
            <span>
              CNPJ{' '}
              <span className="font-medium text-foreground tabular-nums">
                {formatCnpj(request.supplier_cnpj)}
              </span>
            </span>
          </span>
        }
      />
      <RequestDetail
        request={request}
        history={detail.history}
        allowedActions={detail.allowed_actions}
      />
    </>
  )
}
