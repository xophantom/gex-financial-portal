import { Injectable } from '@nestjs/common';
import type { DashboardSummaryResponse } from '@gex/shared';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { toSafeNumber } from '../common/utils/to-safe-number';
import { ClockService } from '../infra/clock/clock.service';
import { RedisService } from '../infra/redis/redis.service';
import { DashboardRepository } from './dashboard.repository';

const CACHE_TTL_SECONDS = 60;

// Contador sem TTL: se reiniciasse, uma leitura com a geração antiga (mais
// alta) voltaria a ser válida.
const GENERATION_KEY = 'dashboard:generation';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly clock: ClockService,
    private readonly redis: RedisService,
  ) {}

  async summary(viewer: AuthenticatedUser): Promise<DashboardSummaryResponse> {
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
    if (cached) return JSON.parse(cached) as DashboardSummaryResponse;

    const row = await this.repository.summary(
      viewer,
      today,
      this.clock.currentMonth(),
      this.clock.timezone(),
    );

    // toSafeNumber lança acima de MAX_SAFE_INTEGER em vez de arredondar. O
    // resultado já é o contrato em JSON puro, então o que vai para o cache é
    // exatamente o que a resposta HTTP entrega.
    const summary: DashboardSummaryResponse = {
      reference_date: today,
      pending_amount_cents: toSafeNumber(row.pending_amount_cents),
      approved_amount_cents: toSafeNumber(row.approved_amount_cents),
      paid_this_month_amount_cents: toSafeNumber(
        row.paid_this_month_amount_cents,
      ),
      overdue_count: toSafeNumber(row.overdue_count),
      request_count: toSafeNumber(row.request_count),
      status_counts: {
        PENDING: toSafeNumber(row.pending_count),
        APPROVED: toSafeNumber(row.approved_count),
        REJECTED: toSafeNumber(row.rejected_count),
        PAID: toSafeNumber(row.paid_count),
      },
    };

    if (key) {
      await this.redis.setNx(key, JSON.stringify(summary), CACHE_TTL_SECONDS);
    }

    return summary;
  }

  // Muda a geração em vez de apagar chaves: entradas antigas ficam
  // inalcançáveis e expiram pelo TTL. Com o Redis fora o INCR se perde, e o
  // pior caso é o cache antigo durar até o fim do TTL quando ele voltar.
  async invalidate(): Promise<void> {
    await this.redis.incrBy(GENERATION_KEY, 1);
  }
}
