import { Logger } from '@nestjs/common'
import { RedisService } from './redis.service'

const KEY = 'login:email:secreto@gex.test'

describe('RedisService with Redis unreachable', () => {
  const originalUrl = process.env.REDIS_URL
  let redis: RedisService
  let warn: jest.SpyInstance

  beforeAll(async () => {
    // Porta 1 nunca tem um Redis: a conexão é recusada na hora.
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    redis = new RedisService()
    await redis.onModuleInit()
  })

  afterAll(() => {
    redis.onModuleDestroy()
    warn.mockRestore()
    process.env.REDIS_URL = originalUrl
  })

  it('answers every data command with a neutral value instead of throwing', async () => {
    await expect(redis.get(KEY)).resolves.toBeNull()
    await expect(redis.setNx(KEY, 'v', 60)).resolves.toBe(false)
    await expect(redis.incrWithTtl(KEY, 60)).resolves.toBeNull()
    await expect(redis.incrBy(KEY, 1)).resolves.toBeNull()
    await expect(redis.delKey(KEY)).resolves.toBeUndefined()
  })

  it('still lets ping() fail, so the health check can report it', async () => {
    await expect(redis.ping()).rejects.toThrow()
  })

  it('logs the outage once, not once per command, and never the key', () => {
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.not.stringContaining('secreto'))
  })
})
