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
  ): Promise<unknown> {
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
    payload: unknown,
  ): Promise<void> {
    // amount_cents ainda é BigInt aqui, e JSON.stringify não o serializa.
    const record: StoredIdempotencyRecord = { fingerprint, response: payload };
    await this.redis.setNx(
      this.key(requesterId, key),
      JSON.stringify(convert(record)),
      TTL_SECONDS,
    );
  }
}
