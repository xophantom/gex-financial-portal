import type { RequestListResponse } from '@gex/shared'
import { CircleAlertIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pagination } from '@/features/requests/pagination'
import { RequestsFilters } from '@/features/requests/requests-filters'
import { RequestsTable } from '@/features/requests/requests-table'
import { ApiError, apiFetchForPage } from '@/lib/api/client'
import { getSessionUser } from '@/lib/session/user'

export const metadata: Metadata = { title: 'Solicitações' }

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// A página inteira é Server Component: cada navegação (inclusive as que
// nuqs dispara ao trocar um filtro) refaz este fetch com os searchParams
// novos. Não existe cache de cliente para invalidar — apiFetch já chama com
// cache: 'no-store' — então a URL sendo a fonte da verdade também garante
// que a lista nunca mostra dado desatualizado.
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canCreate = user.role === 'REQUESTER'

  const status = first(params.status)
  const supplier = first(params.supplier)
  const dueFrom = first(params.due_from)
  const dueTo = first(params.due_to)
  const page = Number(first(params.page) ?? '1') || 1

  const query = new URLSearchParams({ page: String(page), page_size: '20' })
  if (status) query.set('status', status)
  if (supplier) query.set('supplier', supplier)
  if (dueFrom) query.set('due_from', dueFrom)
  if (dueTo) query.set('due_to', dueTo)

  const filtered = Boolean(status || supplier || dueFrom || dueTo)
  const list = await loadList(query)

  return (
    <>
      <PageHeader
        title="Solicitações"
        description={list ? describeTotal(list.total, filtered) : undefined}
      />

      {/* group/list: a tabela esmaece enquanto filtros ou paginação buscam a
          próxima lista (ambos marcam data-pending durante a transição). */}
      <div className="group/list space-y-5">
        <RequestsFilters />

        {list ? (
          <section
            aria-label="Lista de solicitações"
            className="overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-opacity group-has-data-pending/list:opacity-60"
          >
            <RequestsTable rows={list.data} filtered={filtered || page > 1} canCreate={canCreate} />
            <Pagination page={list.page} totalPages={list.total_pages} />
          </section>
        ) : (
          <Alert>
            <CircleAlertIcon aria-hidden="true" className="text-pending" />
            <AlertTitle>Os filtros do endereço não são válidos</AlertTitle>
            <AlertDescription>
              <p>
                Uma data ou um status na URL não existe. Ajuste os filtros acima ou{' '}
                <Link href="/requests">limpe todos os filtros</Link>.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  )
}

function describeTotal(total: number, filtered: boolean): string {
  if (total === 0)
    return filtered
      ? 'Nenhum resultado para os filtros aplicados'
      : 'Nenhuma solicitação cadastrada'
  const noun = total === 1 ? 'solicitação' : 'solicitações'
  if (filtered)
    return `${total} ${noun} ${total === 1 ? 'encontrada' : 'encontradas'} com os filtros aplicados`
  return `${total} ${noun} no total`
}

// A URL é editável à mão: um filtro inválido (data inexistente, status
// desconhecido) volta da API como 422 e vira um aviso na própria página,
// com os filtros à mão para corrigir, em vez do error boundary.
async function loadList(query: URLSearchParams): Promise<RequestListResponse | null> {
  try {
    return await apiFetchForPage<RequestListResponse>(`/requests?${query.toString()}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) return null
    throw error
  }
}
