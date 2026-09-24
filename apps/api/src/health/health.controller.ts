import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { withTimeout } from '../common/with-timeout';
import { RedisService } from '../redis/redis.service';
import { HealthDatabaseClient } from './health-database.client';

// Uma dependência congelada (ex.: `docker pause`) mantém o socket aberto sem
// responder; sem timeout o probe travaria justamente quando deve acusar falha.
const HEALTH_CHECK_TIMEOUT_MS = 1500;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    // Conexão dedicada; ver health-database.client.ts.
    private readonly db: HealthDatabaseClient,
    private readonly redis: RedisService,
  ) {}

  // Chamada sem token pelo healthcheck do Compose.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Reports database and cache liveness' })
  async check(@Res({ passthrough: true }) response: Response) {
    // Em paralelo: a resposta fica limitada ao maior timeout, não à soma.
    const [database, redis] = await Promise.all([
      withTimeout(
        this.db.$queryRaw`SELECT 1`,
        HEALTH_CHECK_TIMEOUT_MS,
        `database check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`,
      )
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
      withTimeout(
        this.redis.ping(),
        HEALTH_CHECK_TIMEOUT_MS,
        `redis check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`,
      )
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
    ]);

    // Redis fora é degradação (cache/idempotência/rate limit somem, a API
    // segue correta); sem banco não há resposta correta possível: 503.
    const status =
      database === 'down' ? 'unhealthy' : redis === 'down' ? 'degraded' : 'ok';

    response.status(database === 'down' ? 503 : 200);

    return { status, checks: { database, redis } };
  }
}
