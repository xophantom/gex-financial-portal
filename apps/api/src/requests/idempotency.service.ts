import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { convert } from '../common/bigint.interceptor';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 86_400;

interface StoredIdempotencyRecord {
  fingerprint: string;
  response: unknown;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  // sha256 do input já validado e normalizado pelo Zod (CNPJ em 14 dígitos,
  // competência AAAA-MM etc.), não do corpo cru — duas requisições
  // logicamente iguais com formatação de entrada diferente (ex.: CNPJ com ou
  // sem máscara) ainda produzem a mesma fingerprint.
  fingerprint(input: unknown): string {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  // Isolada por requesterId: sem isto, dois usuários que por acidente (ou por
  // um cliente HTTP mal configurado) reusassem o mesmo valor de cabeçalho
  // Idempotency-Key compartilhavam a mesma entrada no Redis — um recebia a
  // resposta com os dados financeiros do outro (fornecedor, CNPJ, valor,
  // nome do solicitante).
  private key(requesterId: string, key: string): string {
    return `idempotency:${requesterId}:${key}`;
  }

  async recall(
    requesterId: string,
    key: string,
    fingerprint: string,
  ): Promise<unknown> {
    const stored = await this.redis.get(this.key(requesterId, key));
    if (!stored) return null;

    const record = JSON.parse(stored) as StoredIdempotencyRecord;
    // Corpo diferente sob a mesma chave não é um retry do mesmo pedido — é
    // outro pedido colidindo por acidente na chave (duas bibliotecas de
    // retry gerando o mesmo UUID, ou um cliente que chaveia por sessão em
    // vez de por requisição). Repetir a resposta antiga entregaria uma
    // solicitação que nunca foi criada como se tivesse sido — perda
    // silenciosa do segundo pedido. Devolver null aqui faz o service seguir
    // para o banco, onde o índice único arbitra de verdade.
    return record.fingerprint === fingerprint ? record.response : null;
  }

  async remember(
    requesterId: string,
    key: string,
    fingerprint: string,
    payload: unknown,
  ): Promise<void> {
    // O payload vem direto do service, com amount_cents ainda em BigInt (só o
    // BigIntInterceptor global converte, e isso acontece depois, na saída do
    // controller). JSON.stringify não serializa BigInt — sem convert() aqui,
    // um replay de Idempotency-Key derrubava a requisição com 500.
    const record: StoredIdempotencyRecord = { fingerprint, response: payload };
    await this.redis.setNx(
      this.key(requesterId, key),
      JSON.stringify(convert(record)),
      TTL_SECONDS,
    );
  }
}
