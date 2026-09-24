import type { RequestResponse, StatusEventResponse } from '@gex/shared'
import type { Prisma } from '@prisma/client'
import { toSafeNumber } from '../common/utils/to-safe-number'
import { fromPrismaCategory } from './request-category.mapper'

export type RequestWithRequester = Prisma.RequestGetPayload<{
  include: { requester: { select: { id: true; name: true } } }
}>

type EventWithActor = Prisma.RequestStatusEventGetPayload<{
  include: { actor: { select: { id: true; name: true } } }
}>

// Linha do Prisma para o contrato HTTP de @gex/shared.
export function toRequestResponse(row: RequestWithRequester, today: string): RequestResponse {
  const dueDate = row.dueDate.toISOString().slice(0, 10)

  return {
    id: row.id,
    supplier_name: row.supplierName,
    supplier_cnpj: row.supplierCnpj,
    invoice_number: row.invoiceNumber,
    amount_cents: toSafeNumber(row.amountCents),
    competence: row.competence,
    due_date: dueDate,
    category: fromPrismaCategory(row.category),
    description: row.description,
    status: row.status,
    rejection_reason: row.rejectionReason,
    paid_at: row.paidAt?.toISOString() ?? null,
    payment_reference: row.paymentReference,
    // Calculado no servidor contra a mesma data do dashboard: se a interface
    // calculasse, lista e dashboard poderiam discordar sobre o total vencido.
    is_overdue: (row.status === 'PENDING' || row.status === 'APPROVED') && dueDate < today,
    requester: { id: row.requester.id, name: row.requester.name },
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export function toStatusEventResponse(event: EventWithActor): StatusEventResponse {
  return {
    id: event.id,
    previous_status: event.previousStatus,
    new_status: event.newStatus,
    reason: event.reason,
    created_at: event.createdAt.toISOString(),
    actor: { id: event.actor.id, name: event.actor.name },
  }
}
