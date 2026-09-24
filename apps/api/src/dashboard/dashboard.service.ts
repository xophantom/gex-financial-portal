import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { convert } from '../common/bigint.interceptor';
import { RedisService } from '../redis/redis.service';
import type { Viewer } from '../requests/requests.repository';
import { DashboardRepository } from './dashboard.repository';

const CACHE_TTL_SECONDS = 60;

// Sem TTL (ver RedisService.incr): esta chave é um contador que nunca pode
// reiniciar sozinho, ou uma leitura em voo capturaria uma geração "alta" de
// antes do reset que nunca mais bateria com a baixa atual.
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

    // A geração é capturada ANTES da consulta agregada e entra na chave,
    // além de role+id+data (a chave sem geração já fechava o vazamento
    // entre viewers da Tarefa 13 — isto fecha uma janela diferente: uma
    // escrita que commita e invalida ENQUANTO esta consulta está em voo, e
    // que faria este método gravar no cache um total de antes dela mesma
    // — ver invalidate() abaixo para o porquê disto ser suficiente sem
    // precisar reconferir nada depois de calcular `summary`). Role + id +
    // data, nunca só um deles: o vazamento da Tarefa 13 aconteceu porque a
    // chave dependia só do valor enviado pelo cliente, sem o dono. O id
    // sozinho já distingue os dois solicitantes (dois ids nunca colidem no
    // schema atual), e o role garante que uma entrada nunca é lida como se
    // fosse de outro papel — mesmo que, no futuro, um id deixe de ser
    // exclusivo de um único papel.
    const generation = (await this.redis.get(GENERATION_KEY)) ?? '0';
    const key = `dashboard:${viewer.role}:${viewer.id}:${today}:${generation}`;
    const cached = await this.redis.get(key);

    if (cached) return JSON.parse(cached) as DashboardSummary;

    const row = await this.repository.summary(
      viewer,
      today,
      this.clock.currentMonth(),
      this.clock.timezone(),
    );

    // Os campos ficam BigInt aqui de propósito, como amount_cents em
    // RequestsService.toResponse(): só o BigIntInterceptor global (resposta
    // HTTP) ou convert() logo abaixo (gravação no Redis) fazem a conversão
    // para Number — nunca Number(bigint) direto. Number(bigint) arredonda
    // em silêncio acima de Number.MAX_SAFE_INTEGER em vez de lançar, que é
    // exatamente a armadilha que BigIntInterceptor.convert() existe para
    // fechar (Tarefa 7) e que idempotency.service.ts já evita do mesmo
    // jeito antes de gravar no Redis.
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

    // Sem reconferir a geração aqui de propósito: a chave já carrega a
    // geração capturada ANTES da consulta acima, e um "reconfere e só grava
    // se não mudou" ainda teria seu próprio intervalo entre o reconfere e o
    // setNx — sempre sobra uma folga do tipo tempo-de-checagem-para-uso não
    // importa quantas vezes se reconfira. Gravar incondicionalmente sob a
    // chave `key` (já rotulada com a geração antiga, se foi o caso) é o que
    // fecha a janela de verdade: se um invalidate() rodou enquanto esta
    // consulta estava em voo, esta escrita cai numa chave que a geração
    // NOVA nunca mais vai procurar — a leitura desatualizada não deixa de
    // ser calculada, mas fica impedida de ser servida a mais ninguém, que é
    // a garantia que importa.
    await this.redis.setNx(
      key,
      JSON.stringify(convert(summary)),
      CACHE_TTL_SECONDS,
    );

    return summary;
  }

  // Incrementa a geração em vez de apagar chaves por padrão. Apagar (a
  // versão original deste método) só fecha a janela até a PRÓXIMA entrada
  // ser gravada — e é exatamente uma entrada gravada depois do delete, mas
  // calculada com dados de antes da escrita, que vazava um total
  // desatualizado por até 60s (fix round 1, achado do revisor). Incrementar
  // a geração faz qualquer consulta já em voo, mesmo que termine depois,
  // gravar sob uma chave que a geração nova nunca mais consulta — a leitura
  // desatualizada não é impedida de acontecer, mas é impedida de ser
  // servida a mais alguém. As entradas da geração antiga não ficam mais
  // alcançáveis por nenhum leitor futuro e caem sozinhas do TTL de 60s: não
  // sobra necessidade de um del(pattern) aqui, só memória que o TTL já
  // libera.
  async invalidate(): Promise<void> {
    await this.redis.incr(GENERATION_KEY);
  }
}
