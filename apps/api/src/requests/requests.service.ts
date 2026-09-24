import { Injectable } from '@nestjs/common';
import {
  allowedActionsFor,
  canTransition,
  nextStatusFor,
  type CreateRequestInput,
  type DecisionInput,
  type ListRequestsQuery,
  type MarkPaidInput,
  type RequestDetailResponse,
  type RequestListResponse,
  type RequestResponse,
  type RequestStatus,
} from '@gex/shared';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { AppException } from '../common/errors/app.exception';
import { dateInZone, offsetFor } from '../common/utils/timezone';
import { toSafeNumber } from '../common/utils/to-safe-number';
import { DashboardService } from '../dashboard/dashboard.service';
import { ClockService } from '../infra/clock/clock.service';
import { IdempotencyService } from './idempotency.service';
import { fromPrismaCategory } from './request-category.mapper';
import { RequestsRepository } from './requests.repository';

type RequestWithRequester = Prisma.RequestGetPayload<{
  include: { requester: { select: { id: true; name: true } } };
}>;

// Nomes de coluna como o Prisma os relata em meta.target num P2002.
const DUPLICATE_INVOICE_COLUMNS = ['supplier_cnpj', 'invoice_number'];

// P2002 vale para qualquer constraint única (inclusive chaves primárias);
// só a de (CNPJ, nota) é "nota duplicada".
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

function paidAtError(message: string): AppException {
  return new AppException('VALIDATION_ERROR', message, 422, [
    { field: 'paid_at', message },
  ]);
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly repository: RequestsRepository,
    private readonly clock: ClockService,
    private readonly idempotency: IdempotencyService,
    private readonly dashboard: DashboardService,
  ) {}

  async list(
    query: ListRequestsQuery,
    viewer: AuthenticatedUser,
  ): Promise<RequestListResponse> {
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
    requester: AuthenticatedUser,
    idempotencyKey?: string,
  ): Promise<RequestResponse> {
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

    // Depois do commit e nunca lança (Redis é melhor esforço): uma falha aqui
    // não pode transformar uma escrita gravada em erro para o cliente.
    await this.dashboard.invalidate();

    return response;
  }

  async findOne(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<RequestDetailResponse> {
    const found = await this.repository.findOne(id, viewer);
    // 404 e não 403: 403 confirmaria a existência do registro a quem não pode vê-lo.
    if (!found) {
      throw new AppException('NOT_FOUND', 'Solicitação não encontrada', 404);
    }

    return {
      request: this.toResponse(found, this.clock.today()),
      history: found.events.map((event) => ({
        id: event.id,
        previous_status: event.previousStatus,
        new_status: event.newStatus,
        reason: event.reason,
        created_at: event.createdAt.toISOString(),
        actor: { id: event.actor.id, name: event.actor.name },
      })),
      allowed_actions: allowedActionsFor(found.status, viewer.role),
    };
  }

  async decide(
    id: string,
    input: DecisionInput,
    actor: AuthenticatedUser,
  ): Promise<RequestResponse> {
    const next = nextStatusFor(input.decision);

    const updated = await this.repository.transition(
      id,
      actor.id,
      (current) => {
        this.assertTransition(current.status, next);

        return {
          next,
          patch:
            input.decision === 'REJECT'
              ? { rejectionReason: input.reason }
              : {},
          reason: input.decision === 'REJECT' ? (input.reason ?? null) : null,
        };
      },
    );

    await this.dashboard.invalidate();

    return this.toResponse(updated, this.clock.today());
  }

  async markPaid(
    id: string,
    input: MarkPaidInput,
    actor: AuthenticatedUser,
  ): Promise<RequestResponse> {
    const zone = this.clock.timezone();

    // AAAA-MM-DD compara como string; hoje e a criação são datas civis no
    // fuso da aplicação, não em UTC.
    if (input.paid_at > this.clock.today()) {
      throw paidAtError('A data de pagamento não pode ser futura');
    }

    // Meio-dia, não meia-noite: longe da virada do dia, nenhuma conversão de
    // fuso leva o pagamento para a data vizinha.
    const paidAt = new Date(
      `${input.paid_at}T12:00:00${offsetFor(input.paid_at, zone)}`,
    );

    const updated = await this.repository.transition(
      id,
      actor.id,
      (current) => {
        this.assertTransition(current.status, 'PAID');

        if (input.paid_at < dateInZone(current.createdAt, zone)) {
          throw paidAtError(
            'A data de pagamento não pode ser anterior à criação da solicitação',
          );
        }

        return {
          next: 'PAID' as const,
          patch: { paidAt, paymentReference: input.payment_reference },
          // Os 5 eventos APPROVED→PAID do seed carregam a referência do pagamento
          // no campo reason; gravar null aqui tornaria o histórico inconsistente.
          reason: input.payment_reference,
        };
      },
    );

    await this.dashboard.invalidate();

    return this.toResponse(updated, this.clock.today());
  }

  private assertTransition(from: RequestStatus, to: RequestStatus): void {
    if (!canTransition(from, to)) {
      throw new AppException(
        'INVALID_TRANSITION',
        `Não é possível mudar de ${from} para ${to}`,
        409,
      );
    }
  }

  private toResponse(
    row: RequestWithRequester,
    today: string,
  ): RequestResponse {
    const dueDate = row.dueDate.toISOString().slice(0, 10);

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
      is_overdue:
        (row.status === 'PENDING' || row.status === 'APPROVED') &&
        dueDate < today,
      requester: { id: row.requester.id, name: row.requester.name },
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
