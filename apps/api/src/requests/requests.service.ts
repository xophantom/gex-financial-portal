import { Injectable } from '@nestjs/common';
import type { CreateRequestInput, ListRequestsQuery } from '@gex/shared';
import { Prisma } from '@prisma/client';
import { ClockService } from '../clock/clock.service';
import { AppException } from '../common/http-exception.filter';
import { IdempotencyService } from './idempotency.service';
import {
  RequestsRepository,
  Viewer,
  toCategoryLabel,
} from './requests.repository';

type RequestWithRequester = Prisma.RequestGetPayload<{
  include: { requester: { select: { id: true; name: true } } };
}>;

@Injectable()
export class RequestsService {
  constructor(
    private readonly repository: RequestsRepository,
    private readonly clock: ClockService,
    private readonly idempotency: IdempotencyService,
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

  async create(
    input: CreateRequestInput,
    requester: Viewer,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const replayed = await this.idempotency.recall(idempotencyKey);
      if (replayed) return replayed;
    }

    const created = await this.repository
      .create(input, requester.id)
      .catch((error: unknown) => {
        // P2002 é violação de restrição única; a única que existe nesta
        // tabela é (supplier_cnpj, invoice_number), e é o banco arbitrando a
        // corrida entre criações concorrentes, não uma checagem prévia da
        // aplicação (que teria uma janela de corrida entre o SELECT e o
        // INSERT). PrismaClientKnownRequestError vem de @prisma/client, que
        // apps/api importa direto (não de @gex/shared, que é ESM) — então,
        // ao contrário de ZodError, instanceof é seguro aqui.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new AppException(
            'DUPLICATE_INVOICE',
            'Já existe uma solicitação com este CNPJ e número de nota',
            409,
          );
        }
        throw error;
      });

    const response = this.toResponse(created, this.clock.today());
    if (idempotencyKey)
      await this.idempotency.remember(idempotencyKey, response);

    return response;
  }

  async findOne(id: string, viewer: Viewer) {
    const found = await this.repository.findOne(id, viewer);
    if (!found) {
      throw new AppException('NOT_FOUND', 'Solicitação não encontrada', 404);
    }

    return {
      request: this.toResponse(found.row, this.clock.today()),
      history: found.events.map((event) => ({
        id: event.id,
        previous_status: event.previousStatus,
        new_status: event.newStatus,
        reason: event.reason,
        actor: { id: event.actor.id, name: event.actor.name },
        created_at: event.createdAt.toISOString(),
      })),
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
