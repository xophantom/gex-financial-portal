import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateRequestInput,
  ListRequestsQuery,
  UserRole,
} from '@gex/shared';
import {
  Prisma,
  RequestCategory as PrismaRequestCategory,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Viewer {
  id: string;
  role: UserRole;
}

type RequestCategoryLabel = CreateRequestInput['category'];

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

// Mesmo mapa, sentido inverso: ao criar, o schema Zod entrega o rótulo
// acentuado (é o que o resto do domínio usa) mas o Prisma Client só aceita a
// chave do enum. Derivar do mesmo Map, em vez de declarar uma segunda lista
// solta, é o que impede as duas direções de um dia divergirem.
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
        // id como desempate final: dueDate e createdAt não são únicos — duas
        // linhas com o mesmo vencimento criadas no mesmo milissegundo empatam
        // nas duas, e sem uma terceira chave que seja de fato única, Postgres
        // não garante a mesma ordem de empate entre duas consultas
        // skip/take separadas. Uma escrita concorrente entre a página N e a
        // N+1 pode então fazer uma linha aparecer duas vezes ou nenhuma.
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

      // Auditoria no mesmo commit da criação: uma solicitação sem evento de
      // abertura violaria "cada transição gera um registro". Se o P2002 do
      // create acima disparar, esta chamada nunca acontece — não sobra
      // evento de abertura órfão para uma linha que não existe.
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

  // Escopo por papel replicado do where() de list(): um REQUESTER só enxerga
  // a própria solicitação. Aqui, em vez de devolver uma lista vazia, o
  // método devolve null — é o service quem decide traduzir isso em 404.
  async findOne(id: string, viewer: Viewer) {
    const row = await this.prisma.request.findFirst({
      where: {
        id,
        ...(viewer.role === 'REQUESTER' && { requesterId: viewer.id }),
      },
      include: { requester: { select: { id: true, name: true } } },
    });
    if (!row) return null;

    const events = await this.prisma.requestStatusEvent.findMany({
      where: { requestId: id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return { row, events };
  }
}
