import { Injectable } from '@nestjs/common';
import { REQUEST_CATEGORIES, type ListRequestsQuery } from '@gex/shared';
import {
  Prisma,
  RequestCategory as PrismaRequestCategory,
} from '@prisma/client';
import { ClockService } from '../clock/clock.service';
import { RequestsRepository, Viewer } from './requests.repository';

type RequestWithRequester = Prisma.RequestGetPayload<{
  include: { requester: { select: { id: true; name: true } } };
}>;

type RequestCategoryLabel = (typeof REQUEST_CATEGORIES)[number];

// Direção oposta à do seed (prisma/seed.ts): lá o rótulo com acento vira a
// chave do enum do Prisma antes de gravar; aqui a chave que o client sempre
// devolve (SERVICOS) volta a virar o rótulo com acento (SERVIÇOS) que o
// resto do domínio usa — o client expõe o nome declarado no schema, nunca o
// valor mapeado para o banco via @map.
const CATEGORY_LABEL = new Map<PrismaRequestCategory, RequestCategoryLabel>([
  ['SOFTWARE', 'SOFTWARE'],
  ['SERVICOS', 'SERVIÇOS'],
  ['MARKETING', 'MARKETING'],
  ['INFRAESTRUTURA', 'INFRAESTRUTURA'],
]);

function toCategoryLabel(
  category: PrismaRequestCategory,
): RequestCategoryLabel {
  const label = CATEGORY_LABEL.get(category);
  if (!label) {
    throw new Error(`unknown Prisma request category: ${category}`);
  }
  return label;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly repository: RequestsRepository,
    private readonly clock: ClockService,
  ) {}

  async list(query: ListRequestsQuery, viewer: Viewer) {
    const { data, total } = await this.repository.list(query, viewer);
    const today = this.clock.today();

    return {
      data: data.map((row) => this.toResponse(row, today)),
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / query.page_size)),
    };
  }

  private toResponse(row: RequestWithRequester, today: string) {
    const dueDate = row.dueDate.toISOString().slice(0, 10);

    return {
      id: row.id,
      supplier_name: row.supplierName,
      supplier_cnpj: row.supplierCnpj,
      invoice_number: row.invoiceNumber,
      amount_cents: row.amountCents,
      competence: row.competence,
      due_date: dueDate,
      category: toCategoryLabel(row.category),
      description: row.description,
      status: row.status,
      rejection_reason: row.rejectionReason,
      paid_at: row.paidAt?.toISOString() ?? null,
      payment_reference: row.paymentReference,
      // Calculado no servidor contra a mesma data do dashboard: se a interface
      // calculasse, lista e dashboard poderiam discordar sobre o total vencido.
      is_overdue:
        (row.status === 'PENDING' || row.status === 'APPROVED') &&
        dueDate < today,
      requester: { id: row.requester.id, name: row.requester.name },
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
