import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { withTimeout } from '../../common/utils/with-timeout';

const CONNECT_TIMEOUT_MS = 1_000;
const COMMAND_TIMEOUT_MS = 500;

// O Redis é acessório (cache do dashboard, idempotência, rate limit), nunca
// fonte de verdade. Por isso os métodos de dados são "melhor esforço": uma
// falha vira um aviso no log e um valor neutro (null/false), e quem chama
// segue pelo banco. Só ping() propaga o erro, porque o health check precisa
// dele.
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private available = true;

  // Fail-fast: sem fila offline e com timeout curto por comando, um Redis
  // fora (ou congelado) custa no máximo COMMAND_TIMEOUT_MS por chamada em vez
  // de segurar a requisição por segundos de retentativas.
  private readonly client = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    {
      connectTimeout: CONNECT_TIMEOUT_MS,
      commandTimeout: COMMAND_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
  )
    // Sem listener, o ioredis imprime "Unhandled error event" a cada
    // tentativa de reconexão. Só as transições vão para o log.
    .on('error', (error: Error) => this.markUnavailable(error.message))
    .on('ready', () => this.markAvailable());

  // Espera a primeira conexão por um instante para os primeiros requests já
  // usarem o cache; sem Redis, a API sobe assim mesmo, degradada.
  async onModuleInit(): Promise<void> {
    if (this.client.status === 'ready') return;

    await withTimeout(
      new Promise<void>((resolve) => this.client.once('ready', resolve)),
      CONNECT_TIMEOUT_MS,
      `Redis não respondeu em ${CONNECT_TIMEOUT_MS}ms`,
    ).catch((error: Error) => this.markUnavailable(error.message));
  }

  async get(key: string): Promise<string | null> {
    return this.attempt('GET', () => this.client.get(key), null);
  }

  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return this.attempt(
      'SET NX',
      async () =>
        (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK',
      false,
    );
  }

  async delKey(key: string): Promise<void> {
    await this.attempt('DEL', () => this.client.del(key), 0);
  }

  // null quando o Redis não respondeu: quem chama decide o que fazer sem a
  // contagem (o rate limit de login, por exemplo, deixa passar).
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    return this.attempt(
      'INCR',
      async () => {
        const count = await this.client.incr(key);
        if (count === 1) await this.client.expire(key, ttlSeconds);
        return count;
      },
      null,
    );
  }

  // Sem TTL: serve a contadores que nunca podem reiniciar sozinhos, como a
  // geração do cache do dashboard. by = 0 lê o valor criando a chave em 0.
  async incrBy(key: string, by: number): Promise<number | null> {
    return this.attempt('INCRBY', () => this.client.incrby(key, by), null);
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  private async attempt<T>(
    command: string,
    run: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      const result = await run();
      this.markAvailable();
      return result;
    } catch (error) {
      // Nunca a chave no log: ela carrega e-mail (rate limit) e ids.
      this.markUnavailable(`${command}: ${(error as Error).message}`);
      return fallback;
    }
  }

  private markUnavailable(reason: string): void {
    if (!this.available) return;
    this.available = false;
    this.logger.warn(
      `Redis indisponível (${reason}); seguindo sem cache, idempotência e rate limit`,
    );
  }

  private markAvailable(): void {
    if (this.available) return;
    this.available = true;
    this.logger.log('Redis disponível novamente');
  }
}
