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

  async del(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) await this.client.del(...keys);
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);

    return count;
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
