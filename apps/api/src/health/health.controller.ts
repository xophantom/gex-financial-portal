import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { withTimeout } from '../common/with-timeout';
import { RedisService } from '../redis/redis.service';
import { HealthDatabaseClient } from './health-database.client';

// `docker pause` (usado pelos testes e2e para simular indisponibilidade)
// congela o processo sem derrubar a conexão TCP: sem um timeout aqui, a
// query ou o PING ficam pendurados esperando uma resposta que nunca chega,
// e o endpoint de saúde trava por tempo indefinido — exatamente o cenário
// que ele existe para detectar rápido. Confirmado batendo o teste real:
// sem isto, `reports unhealthy with 503` e o `afterAll` (tentando fechar o
// Prisma contra um banco pausado) estouravam o timeout do Jest e o
// container ficava pausado para sempre.
const HEALTH_CHECK_TIMEOUT_MS = 1500;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    // Conexão dedicada, não a PrismaService @Global() — ver
    // health-database.client.ts para o porquê (Finding 2, fix round 1).
    private readonly db: HealthDatabaseClient,
    private readonly redis: RedisService,
  ) {}

  // @Public(): o healthcheck do container (Docker Compose) chama esta rota
  // sem token — sob o guard global default-nega, sem esta anotação a rota
  // ficaria presa atrás da própria autenticação que o orquestrador não tem
  // como fornecer.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Reports database and cache liveness' })
  async check(@Res({ passthrough: true }) response: Response) {
    // Em paralelo, não em sequência: cada checagem já tem seu próprio
    // timeout, então rodá-las em série somaria os dois piores casos ao
    // invés de limitar a resposta ao maior deles.
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

    // Redis fora é degradação, não incorreção: idempotência e cache somem, a
    // garantia de unicidade continua no índice do banco. Sem banco não há
    // resposta correta possível, então aí é 503.
    const status =
      database === 'down' ? 'unhealthy' : redis === 'down' ? 'degraded' : 'ok';

    response.status(database === 'down' ? 503 : 200);

    return { status, checks: { database, redis } };
  }
}
