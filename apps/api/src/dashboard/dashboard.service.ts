import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { convert } from '../common/bigint.interceptor';
import { RedisService } from '../redis/redis.service';
import type { Viewer } from '../requests/requests.repository';
import { DashboardRepository } from './dashboard.repository';

const CACHE_TTL_SECONDS = 60;

// Contador sem TTL: se reiniciasse, uma leitura com a geração antiga (mais
// alta) voltaria a ser válida.
const GENERATION_KEY = 'dashboard:generation';

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

  async summary(viewer: Viewer) {
    const today = this.clock.today();

    // A geração é lida ANTES da consulta e entra na chave: se uma escrita
    // invalidar enquanto a consulta está em voo, o resultado desatualizado é
    // gravado numa chave que ninguém mais vai ler. INCRBY 0 lê criando a
    // chave em 0; null significa Redis fora, e aí não há cache nenhum —
    // adivinhar a geração poderia servir uma entrada antiga.
    const generation = await this.redis.incrBy(GENERATION_KEY, 0);
    const key =
      generation === null
        ? null
        : `dashboard:${viewer.role}:${viewer.id}:${today}:${generation}`;

    const cached = key ? await this.redis.get(key) : null;
    if (cached) return JSON.parse(cached) as DashboardSummary;

    const row = await this.repository.summary(
      viewer,
      today,
      this.clock.currentMonth(),
      this.clock.timezone(),
    );

    // BigInt até a borda: o BigIntInterceptor (HTTP) e o convert() abaixo
    // (Redis) lançam acima de MAX_SAFE_INTEGER, Number() arredondaria calado.
    const summary = {
      reference_date: today,
      pending_amount_cents: row.pending_amount_cents,
      approved_amount_cents: row.approved_amount_cents,
      paid_this_month_amount_cents: row.paid_this_month_amount_cents,
      overdue_count: row.overdue_count,
      request_count: row.request_count,
      status_counts: {
        PENDING: row.pending_count,
        APPROVED: row.approved_count,
        REJECTED: row.rejected_count,
        PAID: row.paid_count,
      },
    };

    const serialized = JSON.stringify(convert(summary));
    if (key) await this.redis.setNx(key, serialized, CACHE_TTL_SECONDS);

    return summary;
  }

  // Muda a geração em vez de apagar chaves: entradas antigas ficam
  // inalcançáveis e expiram pelo TTL. Com o Redis fora o INCR se perde, e o
  // pior caso é o cache antigo durar até o fim do TTL quando ele voltar.
  async invalidate(): Promise<void> {
    await this.redis.incrBy(GENERATION_KEY, 1);
  }
}
