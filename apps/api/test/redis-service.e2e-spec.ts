import Redis from 'ioredis'
import { RedisService } from '../src/infra/redis/redis.service'
import { startTestRedis, stopTestRedis } from './support/containers'

// Redis real: o TTL só existe de verdade no servidor.
describe('RedisService.incrWithTtl', () => {
  let redis: RedisService
  let inspector: Redis

  beforeAll(async () => {
    process.env.REDIS_URL = await startTestRedis()
    redis = new RedisService()
    await redis.onModuleInit()
    inspector = new Redis(process.env.REDIS_URL)
  }, 60_000)

  afterAll(async () => {
    redis.onModuleDestroy()
    inspector.disconnect()
    await stopTestRedis()
  })

  it('counts and opens the window on the first increment', async () => {
    await expect(redis.incrWithTtl('ttl:first', 300)).resolves.toBe(1)

    const ttl = await inspector.ttl('ttl:first')
    expect(ttl).toBeGreaterThan(290)
    expect(ttl).toBeLessThanOrEqual(300)
  })

  // Janela fixa: tentar de novo não empurra o fim do bloqueio.
  it('keeps the window of the first increment on the following ones', async () => {
    await redis.incrWithTtl('ttl:fixed', 300)
    await inspector.expire('ttl:fixed', 100)

    await expect(redis.incrWithTtl('ttl:fixed', 300)).resolves.toBe(2)
    expect(await inspector.ttl('ttl:fixed')).toBeLessThanOrEqual(100)
  })

  // Uma chave que ficou sem TTL ganha um no próximo incremento, em vez de
  // bloquear para sempre.
  it('gives a TTL to a counter that has none', async () => {
    await inspector.set('ttl:orphan', '7')

    await expect(redis.incrWithTtl('ttl:orphan', 300)).resolves.toBe(8)
    expect(await inspector.ttl('ttl:orphan')).toBeGreaterThan(0)
  })
})
