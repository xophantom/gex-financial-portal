import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Viewer } from '../requests/requests.repository';

interface Row {
  pending_amount_cents: bigint;
  approved_amount_cents: bigint;
  paid_this_month_amount_cents: bigint;
  overdue_count: bigint;
  request_count: bigint;
  pending_count: bigint;
  approved_count: bigint;
  rejected_count: bigint;
  paid_count: bigint;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    viewer: Viewer,
    today: string,
    month: string,
    zone: string,
  ): Promise<Row> {
    const scope =
      viewer.role === 'FINANCE'
        ? Prisma.sql`TRUE`
        : Prisma.sql`requester_id = ${viewer.id}::uuid`;

    // Uma varredura para os quatro indicadores. A conversão de fuso acontece
    // em SQL: trazer as linhas e somar em JavaScript erraria na virada do mês
    // e seria N+1 disfarçado.
    const [row] = await this.prisma.$queryRaw<Row[]>`
      SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PENDING'), 0)  AS pending_amount_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'), 0) AS approved_amount_cents,
        COALESCE(SUM(amount_cents) FILTER (
          WHERE status = 'PAID'
            AND to_char(paid_at AT TIME ZONE ${zone}, 'YYYY-MM') = ${month}
        ), 0) AS paid_this_month_amount_cents,
        COUNT(*) FILTER (
          WHERE status IN ('PENDING','APPROVED') AND due_date < ${today}::date
        ) AS overdue_count,
        COUNT(*)                                        AS request_count,
        COUNT(*) FILTER (WHERE status = 'PENDING')      AS pending_count,
        COUNT(*) FILTER (WHERE status = 'APPROVED')     AS approved_count,
        COUNT(*) FILTER (WHERE status = 'REJECTED')     AS rejected_count,
        COUNT(*) FILTER (WHERE status = 'PAID')         AS paid_count
      FROM requests
      WHERE ${scope}
    `;

    // O agregado sempre devolve uma linha (COUNT/SUM sobre zero linhas ainda
    // é uma linha, com 0), então um undefined aqui só pode significar um erro
    // de driver/tipagem, nunca "sem dados" — a regra do projeto proíbe
    // devolver algo fora do tipo declarado, então isto lança em vez de
    // deixar o service explodir mais adiante com "row is undefined".
    if (!row) {
      throw new Error('dashboard aggregate query returned no rows');
    }

    return row;
  }
}
