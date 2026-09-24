import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../infra/prisma/prisma.service';

// SUM(bigint) vira NUMERIC no Postgres, que o driver do Prisma devolve como
// Prisma.Decimal; COUNT(*) devolve bigint.
interface RawRow {
  pending_amount_cents: Prisma.Decimal;
  approved_amount_cents: Prisma.Decimal;
  paid_this_month_amount_cents: Prisma.Decimal;
  overdue_count: bigint;
  request_count: bigint;
  pending_count: bigint;
  approved_count: bigint;
  rejected_count: bigint;
  paid_count: bigint;
}

export interface DashboardSummaryRow {
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

// Uma soma de centavos inteiros nunca tem fração; se tiver, é dado corrompido
// e lançar é melhor que arredondar em silêncio.
function decimalToBigInt(value: Prisma.Decimal): bigint {
  if (!value.isInteger()) {
    throw new Error(
      `expected an integer amount in cents, got ${value.toString()}`,
    );
  }
  return BigInt(value.toFixed(0));
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    viewer: AuthenticatedUser,
    today: string,
    month: string,
    zone: string,
  ): Promise<DashboardSummaryRow> {
    const scope =
      viewer.role === 'FINANCE'
        ? Prisma.sql`TRUE`
        : Prisma.sql`requester_id = ${viewer.id}::uuid`;

    // Contagens e pendente/aprovado numa varredura só. O pago no mês é uma
    // subconsulta com intervalo [início do mês, início do seguinte) no fuso
    // da aplicação, calculado em SQL: sem to_char por linha, o predicado
    // usa o índice parcial requests_paid_at_idx.
    const monthStart = `${month}-01`;
    const [row] = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PENDING'), 0)  AS pending_amount_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'), 0) AS approved_amount_cents,
        (
          SELECT COALESCE(SUM(amount_cents), 0)
          FROM requests
          WHERE ${scope}
            AND status = 'PAID'
            AND paid_at >= ${monthStart}::date::timestamp AT TIME ZONE ${zone}
            AND paid_at < (${monthStart}::date + interval '1 month') AT TIME ZONE ${zone}
        ) AS paid_this_month_amount_cents,
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

    // Agregado sem GROUP BY sempre devolve uma linha; sem ela, é erro de driver.
    if (!row) {
      throw new Error('dashboard aggregate query returned no rows');
    }

    return {
      ...row,
      pending_amount_cents: decimalToBigInt(row.pending_amount_cents),
      approved_amount_cents: decimalToBigInt(row.approved_amount_cents),
      paid_this_month_amount_cents: decimalToBigInt(
        row.paid_this_month_amount_cents,
      ),
    };
  }
}
