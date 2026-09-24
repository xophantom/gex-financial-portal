import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { DASHBOARD_TITLE } from './dashboard-summary'

// Mesma forma da tela carregada (cabeçalho, régua de indicadores, régua de
// status) para que o conteúdo substitua o esqueleto sem deslocar a página. O
// título é real: só o que depende da API fica em esqueleto.
export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando indicadores...</span>
      <div aria-hidden="true">
        <PageHeader
          title={DASHBOARD_TITLE}
          // Um <span> e não o <Skeleton> (div): a descrição é um <p>.
          description={
            <span className="block h-5 w-80 max-w-full animate-pulse rounded-md bg-muted" />
          }
          actions={<Skeleton className="h-5 w-36" />}
        />
        <div className="space-y-6">
          <div className="grid divide-y overflow-hidden rounded-lg border bg-card shadow-xs lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 px-5 py-4 lg:flex-col lg:items-start lg:gap-2.5 lg:px-6 lg:pt-5 lg:pb-6"
              >
                <Skeleton className="h-9 w-28 lg:h-5" />
                <Skeleton className="h-6 w-24 lg:h-7 lg:w-36" />
                <Skeleton className="hidden h-4 w-40 lg:block" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-xs lg:p-6">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="mt-5 h-3 w-full rounded-full" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-xs">
            <div className="px-6 pt-5 pb-3">
              <Skeleton className="h-6 w-52" />
            </div>
            <div className="divide-y border-t">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-4 px-6 py-3.5">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
