import Link from 'next/link'
import { formatCentsToBrl } from '@gex/shared'
import { EmptyState } from './empty-state'
import { StatusBadge } from './status-badge'

// Forma de uma linha de GET /requests (apps/api/src/requests/requests.service.ts
// toResponse()). Só os campos que esta tela usa — não é o contrato inteiro.
export interface RequestRow {
  id: string
  supplier_name: string
  supplier_cnpj: string
  invoice_number: string
  amount_cents: number
  due_date: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
  is_overdue: boolean
  requester: { id: string; name: string }
}

// due_date chega como AAAA-MM-DD (já uma data de calendário validada pelo
// backend) — fatiar a string evita qualquer conversão de fuso horário que um
// `new Date(iso)` faria ao interpretar a meia-noite UTC.
function formatDueDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
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
              {formatDueDate(row.due_date)}
              {row.is_overdue && (
                // Rótulo em texto, não só a cor do badge — daltonismo e leitor de
                // tela não percebem "vermelho", precisam da palavra.
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
