import type { Metadata } from 'next'
import Link from 'next/link'
import { Pagination } from '@/components/pagination'
import { RequestsFilters } from '@/components/requests-filters'
import { RequestsTable, type RequestRow } from '@/components/requests-table'
import { ApiError, apiFetchForPage } from '@/lib/api-client'
import { readSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Solicitações' }

// Forma de GET /requests (apps/api/src/requests/requests.controller.ts +
// requests.service.ts). Duplicada aqui como em dashboard/page.tsx: apps/web
// e apps/api só compartilham @gex/shared (regras de domínio), não a forma de
// uma resposta HTTP.
interface RequestsListResponse {
  data: RequestRow[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

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
  const session = await readSession()

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

  const list = await loadList(query)

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Solicitações</h1>
        {session?.user.role === 'REQUESTER' && (
          <Link
            href="/requests/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Nova solicitação
          </Link>
        )}
      </div>

      <div className="mt-6">
        <RequestsFilters />
      </div>

      <div className="mt-6">
        {list ? (
          <>
            <RequestsTable rows={list.data} />
            <Pagination page={list.page} totalPages={list.total_pages} />
          </>
        ) : (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            Os filtros informados no endereço são inválidos. Corrija-os acima ou{' '}
            <Link href="/requests" className="font-medium underline">
              limpe os filtros
            </Link>
            .
          </div>
        )}
      </div>
    </main>
  )
}

// A URL é editável à mão: um filtro inválido (data inexistente, status
// desconhecido) volta da API como 422 e vira um aviso na própria página,
// com os filtros à mão para corrigir, em vez do error boundary.
async function loadList(query: URLSearchParams): Promise<RequestsListResponse | null> {
  try {
    return await apiFetchForPage<RequestsListResponse>(`/requests?${query.toString()}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) return null
    throw error
  }
}
