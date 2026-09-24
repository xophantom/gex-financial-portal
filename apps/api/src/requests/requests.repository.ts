import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateRequestInput,
  ListRequestsQuery,
  RequestStatus,
} from '@gex/shared';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../infra/prisma/prisma.service';
import { toPrismaCategory } from './request-category.mapper';

// % e _ são curingas de LIKE: sem escape, buscar "100%" casa com tudo.
const escapeLike = (term: string) =>
  term.replace(/[\\%_]/g, (char) => `\\${char}`);

@Injectable()
export class RequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(
    query: ListRequestsQuery,
    viewer: AuthenticatedUser,
  ): Prisma.RequestWhereInput {
    return {
      ...(viewer.role === 'REQUESTER' && { requesterId: viewer.id }),
      ...(query.status && { status: query.status }),
      ...(query.supplier && {
        supplierName: {
          contains: escapeLike(query.supplier),
          mode: 'insensitive',
        },
      }),
      ...((query.due_from || query.due_to) && {
        dueDate: {
          ...(query.due_from && {
            gte: new Date(`${query.due_from}T00:00:00Z`),
          }),
          ...(query.due_to && { lte: new Date(`${query.due_to}T00:00:00Z`) }),
        },
      }),
    };
  }

  async list(query: ListRequestsQuery, viewer: AuthenticatedUser) {
    const where = this.where(query, viewer);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: { requester: { select: { id: true, name: true } } },
        // id como desempate final: sem uma chave única, o Postgres não
        // garante a mesma ordem entre páginas e uma linha pode repetir ou sumir.
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
      this.prisma.request.count({ where }),
    ]);

    return { data, total };
  }

  async create(input: CreateRequestInput, requesterId: string) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          id: randomUUID(),
          requesterId,
          supplierName: input.supplier_name,
          supplierCnpj: input.supplier_cnpj,
          invoiceNumber: input.invoice_number,
          amountCents: BigInt(input.amount_cents),
          competence: input.competence,
          dueDate: new Date(`${input.due_date}T00:00:00Z`),
          category: toPrismaCategory(input.category),
          description: input.description ?? null,
          status: 'PENDING',
        },
        include: { requester: { select: { id: true, name: true } } },
      });

      // Evento de abertura no mesmo commit: toda transição gera auditoria.
      await tx.requestStatusEvent.create({
        data: {
          id: randomUUID(),
          requestId: created.id,
          actorId: requesterId,
          previousStatus: null,
          newStatus: 'PENDING',
          reason: null,
        },
      });

      return created;
    });
  }

  // Mesmo escopo por papel de list(); null vira 404 no service.
  async findOne(id: string, viewer: AuthenticatedUser) {
    return this.prisma.request.findFirst({
      // O escopo entra no WHERE, não num if depois da busca: assim o registro
      // alheio simplesmente não existe para quem consulta, e a rota devolve 404.
      where: {
        id,
        ...(viewer.role === 'REQUESTER' && { requesterId: viewer.id }),
      },
      include: {
        requester: { select: { id: true, name: true } },
        events: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async transition(
    id: string,
    actorId: string,
    decide: (current: { status: RequestStatus; createdAt: Date }) => {
      next: RequestStatus;
      patch: Prisma.RequestUpdateInput;
      reason: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // FOR UPDATE serializa decisões concorrentes sobre a mesma solicitação;
      // sem ele, duas aprovações simultâneas leem PENDING e gravam dois eventos.
      const [locked] = await tx.$queryRaw<
        Array<{ id: string; status: RequestStatus; createdAt: Date }>
      >`
        SELECT id, status, created_at AS "createdAt"
        FROM requests
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;

      if (!locked)
        throw new AppException('NOT_FOUND', 'Solicitação não encontrada', 404);

      const { next, patch, reason } = decide(locked);

      const updated = await tx.request.update({
        where: { id },
        data: { ...patch, status: next },
        include: { requester: { select: { id: true, name: true } } },
      });

      await tx.requestStatusEvent.create({
        data: {
          id: randomUUID(),
          requestId: id,
          actorId,
          previousStatus: locked.status,
          newStatus: next,
          reason,
        },
      });

      return updated;
    });
  }
}
