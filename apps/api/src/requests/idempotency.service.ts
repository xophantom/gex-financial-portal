import { Injectable } from '@nestjs/common';
import { convert } from '../common/bigint.interceptor';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 86_400;

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  async recall(key: string): Promise<unknown> {
    const stored = await this.redis.get(`idempotency:${key}`);

    return stored ? JSON.parse(stored) : null;
  }

  async remember(key: string, payload: unknown): Promise<void> {
    // O payload vem direto do service, com amount_cents ainda em BigInt (só o
    // BigIntInterceptor global converte, e isso acontece depois, na saída do
    // controller). JSON.stringify não serializa BigInt — sem convert() aqui,
    // um replay de Idempotency-Key derrubava a requisição com 500.
    await this.redis.setNx(
      `idempotency:${key}`,
      JSON.stringify(convert(payload)),
      TTL_SECONDS,
    );
  }
}
