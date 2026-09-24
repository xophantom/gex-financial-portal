import { formatCentsToBrl, type RequestStatus } from '@gex/shared'
import Link from 'next/link'
import { formatCalendarDate } from '@/format/dates'
import { EmptyState } from './empty-state'
import { StatusBadge } from './status-badge'

// Linha de GET /requests — só os campos que esta tela usa.
export interface RequestRow {
  id: string
  supplier_name: string
  supplier_cnpj: string
  invoice_number: string
  amount_cents: number
  due_date: string
  status: RequestStatus
  is_overdue: boolean
  requester: { id: string; name: string }
}

export function RequestsTable({ rows }: { rows: RequestRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="Nenhuma solicitação encontrada para os filtros atuais." />
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-4 font-medium">
            Fornecedor
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Nota
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Valor
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Vencimento
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Status
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Solicitante
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-900">
            <td className="py-2 pr-4">
              <Link
                href={`/requests/${row.id}`}
                className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
              >
                {row.supplier_name}
              </Link>
            </td>
            <td className="py-2 pr-4">{row.invoice_number}</td>
            <td className="py-2 pr-4">{`R$ ${formatCentsToBrl(row.amount_cents)}`}</td>
            <td className="py-2 pr-4">
              {formatCalendarDate(row.due_date)}
              {row.is_overdue && (
                // Texto, não só cor: leitor de tela e daltonismo precisam da palavra.
                <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  Vencida
                </span>
              )}
            </td>
            <td className="py-2 pr-4">
              <StatusBadge status={row.status} />
            </td>
            <td className="py-2 pr-4">{row.requester.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
