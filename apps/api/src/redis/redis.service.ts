import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );

  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  // Chave exata, não glob: usa DEL diretamente, sem nunca varrer o keyspace.
  // É isto que qualquer call site que sabe exatamente qual chave apagar deve
  // chamar — nunca `del(pattern)` abaixo para esse caso.
  async delKey(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Apagar por padrão ainda pode ser genuinamente necessário (ex.: invalidar
  // todas as chaves de idempotência de uma entidade, ou um cache por
  // prefixo) — mas KEYS varre o keyspace inteiro e BLOQUEIA o Redis (que é
  // single-threaded) até terminar, o que é inaceitável em qualquer caminho
  // que rode em produção com outras chaves no mesmo banco. SCAN faz o mesmo
  // trabalho em lotes, com cursor, sem bloquear.
  async del(pattern: string): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      if (keys.length > 0) await this.client.del(...keys);
      cursor = nextCursor;
    } while (cursor !== '0');
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);

    return count;
  }

  // Sem TTL, ao contrário de incrWithTtl: para um contador de geração (ex.:
  // dashboard.service.ts), a chave precisa sobreviver indefinidamente — um
  // TTL que expirasse reiniciaria a contagem do zero, e uma leitura que
  // capturou a geração alta de antes do reset nunca mais bateria com a
  // baixa atual. Inofensivo por si só (o pior efeito é um cache miss a
  // mais), mas sem necessidade nenhuma de aceitar isso quando o caso de uso
  // é justamente "nunca reiniciar".
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
