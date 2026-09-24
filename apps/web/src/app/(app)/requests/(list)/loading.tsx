import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { RequestsTableSkeleton } from '@/features/requests/requests-table'
import { cn } from '@/lib/utils'

// Esqueleto com a forma da lista (cabeçalho, filtros, linhas da tabela), para
// a primeira entrada na rota. Trocar filtro ou página não passa por aqui: essas
// navegações rodam em transição e mantêm a lista atual, esmaecida, na tela.
// Mora no grupo (list) para valer só para a lista: em requests/ ele também
// envolveria /requests/new e /requests/[id], que mostrariam a tabela fantasma.
export default function RequestsLoading() {
  return (
    <div aria-busy="true">
      <PageHeader
        title="Solicitações"
        description={<span role="status">Carregando solicitações…</span>}
      />

      <div aria-hidden="true" className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <FilterSkeleton className="md:flex-1" />
          <FilterSkeleton className="md:w-44" />
          <FilterSkeleton className="md:w-84" />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <RequestsTableSkeleton />
        </div>
      </div>
    </div>
  )
}

function FilterSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}
