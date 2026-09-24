import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { RedisService } from '../redis/redis.service';
import type { Viewer } from '../requests/requests.repository';
import { DashboardRepository } from './dashboard.repository';

const CACHE_TTL_SECONDS = 60;

export interface DashboardSummary {
  reference_date: string;
  pending_amount_cents: number;
  approved_amount_cents: number;
  paid_this_month_amount_cents: number;
  overdue_count: number;
  request_count: number;
  status_counts: {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    PAID: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly clock: ClockService,
    private readonly redis: RedisService,
  ) {}

  async summary(viewer: Viewer): Promise<DashboardSummary> {
    const today = this.clock.today();
    // A chave carrega role + id + data, nunca só um deles: o vazamento da
    // Tarefa 13 aconteceu porque uma chave de cache dependia só do valor
    // enviado pelo cliente, sem o dono. Aqui o id sozinho distingue os dois
    // solicitantes (dois ids nunca colidem no schema atual), e o role
    // garante que uma entrada nunca é lida como se fosse de outro papel —
    // mesmo que, no futuro, um id deixe de ser exclusivo de um único papel.
    const key = `dashboard:${viewer.role}:${viewer.id}:${today}`;
    const cached = await this.redis.get(key);

    if (cached) return JSON.parse(cached) as DashboardSummary;

    const row = await this.repository.summary(
      viewer,
      today,
      this.clock.currentMonth(),
      this.clock.timezone(),
    );

    const summary: DashboardSummary = {
      reference_date: today,
      pending_amount_cents: Number(row.pending_amount_cents),
      approved_amount_cents: Number(row.approved_amount_cents),
      paid_this_month_amount_cents: Number(row.paid_this_month_amount_cents),
      overdue_count: Number(row.overdue_count),
      request_count: Number(row.request_count),
      status_counts: {
        PENDING: Number(row.pending_count),
        APPROVED: Number(row.approved_count),
        REJECTED: Number(row.rejected_count),
        PAID: Number(row.paid_count),
      },
    };

    await this.redis.setNx(key, JSON.stringify(summary), CACHE_TTL_SECONDS);

    return summary;
  }

  // Padrão, não chave exata: uma escrita de um único viewer muda o que
  // TODOS os outros veem (financeiro enxerga o total global; um requester
  // que cria/tem uma solicitação decidida muda tanto o próprio recorte
  // quanto o de financeiro) — não existe um conjunto pequeno e conhecido de
  // chaves exatas para apagar aqui, então este é o caso legítimo de del()
  // por padrão descrito em redis.service.ts (SCAN, nunca KEYS).
  async invalidate(): Promise<void> {
    await this.redis.del('dashboard:*');
  }
}
