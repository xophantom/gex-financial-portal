import { Injectable } from '@nestjs/common';
import type { ListRequestsQuery, UserRole } from '@gex/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Viewer {
  id: string;
  role: UserRole;
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
}
