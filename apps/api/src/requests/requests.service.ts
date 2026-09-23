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

// Nomes de coluna (snake_case), como o Postgres/Prisma os relata em
// meta.target — confirmado batendo em um P2002 real contra o schema desta
// tabela, não assumido.
const DUPLICATE_INVOICE_COLUMNS = ['supplier_cnpj', 'invoice_number'];

// P2002 dispara para QUALQUER violação de unicidade na tabela, não só a de
// negócio — Request.id e RequestStatusEvent.id também são colunas únicas
// (chaves primárias geradas por randomUUID()). Hoje elas nunca colidem, mas
// "não é alcançável hoje" já mordeu este projeto quatro vezes: no dia em que
// alguém acrescentar uma nova constraint única a Request ou
// RequestStatusEvent, um P2002 dela seria erroneamente reportado ao cliente
// como "nota duplicada" sem esta checagem do meta.target.
function isDuplicateInvoiceViolation(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  return (
    Array.isArray(target) &&
    target.length === DUPLICATE_INVOICE_COLUMNS.length &&
    DUPLICATE_INVOICE_COLUMNS.every((column) => target.includes(column))
  );
}

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
    // Calculada uma vez, mesmo antes de saber se vai replay ou criar: tem que
    // ser exatamente a mesma fingerprint tanto na leitura (recall) quanto na
    // escrita (remember) para uma requisição idêntica bater consigo mesma.
    const fingerprint = idempotencyKey
      ? this.idempotency.fingerprint(input)
      : undefined;

    if (idempotencyKey) {
      const replayed = await this.idempotency.recall(
        requester.id,
        idempotencyKey,
        fingerprint!,
      );
      if (replayed) return replayed;
    }

    const created = await this.repository
      .create(input, requester.id)
      .catch((error: unknown) => {
        // PrismaClientKnownRequestError vem de @prisma/client, que apps/api
        // importa direto (não de @gex/shared, que é ESM) — então, ao
        // contrário de ZodError, instanceof é seguro aqui.
        // isDuplicateInvoiceViolation ainda confirma QUAL constraint disparou
        // (ver comentário na função) antes de traduzir para o código de
        // negócio.
        if (isDuplicateInvoiceViolation(error)) {
          throw new AppException(
            'DUPLICATE_INVOICE',
            'Já existe uma solicitação com este CNPJ e número de nota',
            409,
          );
        }
        throw error;
      });

    const response = this.toResponse(created, this.clock.today());
    if (idempotencyKey) {
      await this.idempotency.remember(
        requester.id,
        idempotencyKey,
        fingerprint!,
        response,
      );
    }

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
