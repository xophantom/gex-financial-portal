import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateRequestInput,
  ListRequestsQuery,
  RequestStatus,
  UserRole,
} from '@gex/shared';
import {
  Prisma,
  RequestCategory as PrismaRequestCategory,
} from '@prisma/client';
import { AppException } from '../common/http-exception.filter';
import { PrismaService } from '../prisma/prisma.service';

export interface Viewer {
  id: string;
  role: UserRole;
}

type RequestCategoryLabel = CreateRequestInput['category'];

// O client do Prisma expõe a chave do enum (SERVICOS), não o valor do @map;
// o domínio usa o rótulo com acento (SERVIÇOS).
const CATEGORY_LABEL = new Map<PrismaRequestCategory, RequestCategoryLabel>([
  ['SOFTWARE', 'SOFTWARE'],
  ['SERVICOS', 'SERVIÇOS'],
  ['MARKETING', 'MARKETING'],
  ['INFRAESTRUTURA', 'INFRAESTRUTURA'],
]);

// Derivado do mesmo Map para que as duas direções nunca divirjam.
const CATEGORY_KEY = new Map<RequestCategoryLabel, PrismaRequestCategory>(
  Array.from(CATEGORY_LABEL, ([key, label]) => [label, key]),
);

export function toCategoryLabel(
  category: PrismaRequestCategory,
): RequestCategoryLabel {
  const label = CATEGORY_LABEL.get(category);
  if (!label) {
    throw new Error(`unknown Prisma request category: ${category}`);
  }
  return label;
}

export function toCategoryKey(
  label: RequestCategoryLabel,
): PrismaRequestCategory {
  const key = CATEGORY_KEY.get(label);
  if (!key) {
    throw new Error(`unknown request category label: ${label}`);
  }
  return key;
}

// % e _ são curingas de LIKE: sem escape, buscar "100%" casa com tudo.
const escapeLike = (term: string) =>
  term.replace(/[\\%_]/g, (char) => `\\${char}`);

@Injectable()
export class RequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(
    query: ListRequestsQuery,
    viewer: Viewer,
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

  async list(query: ListRequestsQuery, viewer: Viewer) {
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
          category: toCategoryKey(input.category),
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
  async findOne(id: string, viewer: Viewer) {
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
