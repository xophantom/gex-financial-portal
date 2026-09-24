import { Injectable } from '@nestjs/common';
import {
  allowedActionsFor,
  canTransition,
  nextStatusFor,
  type CreateRequestInput,
  type DecisionInput,
  type ListRequestsQuery,
  type MarkPaidInput,
  type RequestStatus,
} from '@gex/shared';
import { Prisma } from '@prisma/client';
import { ClockService } from '../clock/clock.service';
import { AppException } from '../common/http-exception.filter';
import { offsetFor } from '../common/timezone';
import { DashboardService } from '../dashboard/dashboard.service';
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
    private readonly dashboard: DashboardService,
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

    // Só no ramo de criação de verdade, nunca no replay acima (que devolve
    // antes de chegar aqui): um replay não muda nenhuma linha em requests,
    // então invalidar o dashboard ali seria trabalho sem efeito nenhum no
    // agregado. Uma criação nova sempre muda pending_amount_cents — do
    // próprio solicitante e do total que financeiro vê.
    await this.dashboard.invalidate();

    return response;
  }

  async findOne(id: string, viewer: Viewer) {
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

  async decide(id: string, input: DecisionInput, actor: Viewer) {
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

    // transition() só resolve depois de um UPDATE de verdade (assertTransition
    // já teria lançado antes disso para uma transição inválida) — então
    // chegar aqui sempre significa que pending/approved mudaram para o
    // financeiro e para o solicitante dono da linha.
    await this.dashboard.invalidate();

    return this.toResponse(updated, this.clock.today());
  }

  async markPaid(id: string, input: MarkPaidInput, actor: Viewer) {
    const paidAt = this.resolvePaidAt(input.paid_at);

    const updated = await this.repository.transition(
      id,
      actor.id,
      (current) => {
        this.assertTransition(current.status, 'PAID');

        return {
          next: 'PAID' as const,
          patch: { paidAt, paymentReference: input.payment_reference },
          // Os 5 eventos APPROVED→PAID do seed carregam a referência do pagamento
          // no campo reason; gravar null aqui tornaria o histórico inconsistente.
          reason: input.payment_reference,
        };
      },
    );

    // Mesmo raciocínio do decide() acima: só chega aqui depois de um UPDATE
    // de verdade para PAID, que move dinheiro de approved_amount_cents para
    // paid_this_month_amount_cents tanto para financeiro quanto para o
    // solicitante dono da linha.
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

  private resolvePaidAt(input: string): Date {
    const zone = this.clock.timezone();
    // Meio-dia, não meia-noite: meia-noite fica a poucas horas da fronteira do
    // dia e qualquer conversão de fuso empurra o pagamento para o dia anterior.
    const resolved = input.includes('T')
      ? new Date(input)
      : new Date(`${input}T12:00:00${offsetFor(input, zone)}`);

    if (resolved.toISOString().slice(0, 10) > this.clock.today()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'A data de pagamento não pode ser futura',
        422,
        [
          {
            field: 'paid_at',
            message: 'A data de pagamento não pode ser futura',
          },
        ],
      );
    }

    return resolved;
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
