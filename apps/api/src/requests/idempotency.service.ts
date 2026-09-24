import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { RequestResponse } from '@gex/shared';
import { RedisService } from '../infra/redis/redis.service';

const TTL_SECONDS = 86_400;

interface StoredIdempotencyRecord {
  fingerprint: string;
  response: RequestResponse;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  // Sobre o input já normalizado pelo Zod: CNPJ com ou sem máscara gera a
  // mesma fingerprint.
  fingerprint(input: unknown): string {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  // Por solicitante: a mesma Idempotency-Key vinda de outro usuário nunca
  // pode devolver a resposta (e os dados financeiros) de quem a usou antes.
  private key(requesterId: string, key: string): string {
    return `idempotency:${requesterId}:${key}`;
  }

  // Com o Redis fora, get() devolve null e o pedido segue para o banco, onde
  // o índice único (CNPJ, nota) continua impedindo a duplicata.
  async recall(
    requesterId: string,
    key: string,
    fingerprint: string,
  ): Promise<RequestResponse | null> {
    const stored = await this.redis.get(this.key(requesterId, key));
    if (!stored) return null;

    const record = JSON.parse(stored) as StoredIdempotencyRecord;
    // Corpo diferente sob a mesma chave é outro pedido, não um retry:
    // repetir a resposta antiga descartaria o segundo em silêncio.
    return record.fingerprint === fingerprint ? record.response : null;
  }

  async remember(
    requesterId: string,
    key: string,
    fingerprint: string,
    response: RequestResponse,
  ): Promise<void> {
    // A resposta já está no formato do contrato (amount_cents em number, datas
    // em ISO), então o JSON gravado é o mesmo que o primeiro pedido recebeu.
    const record: StoredIdempotencyRecord = { fingerprint, response };
    await this.redis.setNx(
      this.key(requesterId, key),
      JSON.stringify(record),
      TTL_SECONDS,
    );
  }
}
