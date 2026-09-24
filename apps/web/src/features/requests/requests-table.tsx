import { formatCnpj, type RequestResponse } from '@gex/shared'
import { FilePlusIcon, InboxIcon, PlusIcon, SearchXIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '@/components/status/status-badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCalendarDate } from '@/lib/format/dates'
import { formatBrl } from '@/lib/format/money'
import { cn } from '@/lib/utils'

type RequestsTableProps = {
  rows: RequestResponse[]
  // Diferencia "nada cadastrado ainda" de "nada para estes filtros": cada um
  // pede uma ação diferente no estado vazio.
  filtered?: boolean
  canCreate?: boolean
}

// Uma marcação para as duas larguras: tabela no desktop; no celular cada linha
// vira um bloco, porque rolar seis colunas de lado esconderia valor e status.
// As classes são compartilhadas com o esqueleto de carregamento.
const ROW =
  'max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-1.5 max-md:px-4 max-md:py-3.5'
const CELL = {
  supplier: 'py-2.5 pl-4 max-md:col-start-1 max-md:row-start-1 max-md:p-0 max-md:whitespace-normal',
  invoice: 'text-muted-foreground max-md:col-start-1 max-md:row-start-2 max-md:p-0 max-md:text-sm',
  due: 'tabular-nums max-md:col-start-2 max-md:row-start-2 max-md:p-0 max-md:text-right',
  status: 'max-md:col-start-1 max-md:row-start-3 max-md:mt-1 max-md:p-0',
  requester:
    'text-muted-foreground max-md:col-start-2 max-md:row-start-3 max-md:mt-1 max-md:self-center max-md:p-0 max-md:text-right max-md:text-sm',
  amount:
    'pr-4 text-right font-medium tabular-nums max-md:col-start-2 max-md:row-start-1 max-md:p-0',
}

export function RequestsTable({ rows, filtered = false, canCreate = false }: RequestsTableProps) {
  if (rows.length === 0) {
    return <RequestsEmpty filtered={filtered} canCreate={canCreate} />
  }

  return (
    <Table className="max-md:block">
      <RequestsTableHeader />
      <TableBody className="max-md:block">
        {rows.map((row) => (
          <TableRow
            key={row.id}
            // relative + o ::after do link: a linha inteira é clicável, mas o
            // único alvo interativo continua sendo um <a> de verdade.
            className={cn(
              'relative has-[a:focus-visible]:bg-muted/60 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring',
              ROW,
            )}
          >
            <TableCell className={CELL.supplier}>
              <Link
                href={`/requests/${row.id}`}
                className="font-medium text-foreground outline-none after:absolute after:inset-0 hover:text-primary"
              >
                {row.supplier_name}
              </Link>
              <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums max-md:hidden">
                {formatCnpj(row.supplier_cnpj)}
              </span>
            </TableCell>
            <TableCell className={CELL.invoice}>{row.invoice_number}</TableCell>
            <TableCell className={CELL.due}>
              <span className="max-md:text-sm max-md:text-muted-foreground">
                {formatCalendarDate(row.due_date)}
              </span>
              {row.is_overdue && (
                // Texto, não só cor: leitor de tela e daltonismo precisam da palavra.
                <span className="block text-xs font-medium text-pending max-md:inline max-md:pl-1.5">
                  Vencida
                </span>
              )}
            </TableCell>
            <TableCell className={CELL.status}>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className={CELL.requester}>{row.requester.name}</TableCell>
            <TableCell className={CELL.amount}>{formatBrl(row.amount_cents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// Esqueleto usado pelo loading.tsx da rota: mesmas colunas, mesma grade no
// celular, linhas com a altura das reais (nome + CNPJ).
export function RequestsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Table aria-hidden="true" className="max-md:block">
      <RequestsTableHeader />
      <TableBody className="max-md:block">
        {Array.from({ length: rows }, (_, index) => (
          <TableRow key={index} className={cn('hover:bg-transparent', ROW)}>
            <TableCell className={CELL.supplier}>
              <Skeleton className="my-0.5 h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-28 max-md:hidden" />
            </TableCell>
            <TableCell className={CELL.invoice}>
              <Skeleton className="h-4 w-26" />
            </TableCell>
            <TableCell className={CELL.due}>
              <Skeleton className="h-4 w-20 max-md:ml-auto" />
            </TableCell>
            <TableCell className={CELL.status}>
              <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>
            <TableCell className={CELL.requester}>
              <Skeleton className="h-4 w-28 max-md:ml-auto" />
            </TableCell>
            <TableCell className={CELL.amount}>
              <Skeleton className="ml-auto h-4 w-20" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RequestsTableHeader() {
  const head = 'text-muted-foreground'
  return (
    // No celular o cabeçalho sai da tela mas continua para leitores de tela.
    <TableHeader className="bg-muted/60 max-md:sr-only">
      <TableRow className="hover:bg-transparent">
        <TableHead scope="col" className={cn(head, 'pl-4')}>
          Fornecedor
        </TableHead>
        <TableHead scope="col" className={head}>
          Nota fiscal
        </TableHead>
        <TableHead scope="col" className={head}>
          Vencimento
        </TableHead>
        <TableHead scope="col" className={head}>
          Status
        </TableHead>
        <TableHead scope="col" className={head}>
          Solicitante
        </TableHead>
        <TableHead scope="col" className={cn(head, 'pr-4 text-right')}>
          Valor
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

function RequestsEmpty({ filtered, canCreate }: { filtered: boolean; canCreate: boolean }) {
  if (filtered) {
    return (
      <Empty className="py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle className="text-base">Nenhuma solicitação para esses filtros</EmptyTitle>
          <EmptyDescription>
            Confira o nome do fornecedor ou amplie o período de vencimento.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/requests">
              <XIcon data-icon="inline-start" aria-hidden="true" />
              Limpar filtros
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Empty className="py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">{canCreate ? <FilePlusIcon /> : <InboxIcon />}</EmptyMedia>
        <EmptyTitle className="text-base">Nenhuma solicitação ainda</EmptyTitle>
        <EmptyDescription>
          {canCreate
            ? 'Cadastre uma nota fiscal para enviá-la à aprovação do financeiro.'
            : 'As notas fiscais cadastradas pelos solicitantes aparecem aqui para aprovação.'}
        </EmptyDescription>
      </EmptyHeader>
      {canCreate && (
        <EmptyContent>
          <Button asChild>
            <Link href="/requests/new">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Cadastrar solicitação
            </Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
