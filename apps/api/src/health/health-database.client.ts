import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Conexão dedicada ao probe, fora do pool da aplicação: com o pool saturado
// o probe não entra na fila (falso "down"), e com o banco congelado uma query
// presa não vaza conexões do pool que atende tráfego real. connection_limit=1
// limita o vazamento a uma conexão; socket_timeout=2 faz o engine liberá-la.
@Injectable()
export class HealthDatabaseClient
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor() {
    super({ datasources: { db: { url: healthDatabaseUrl() } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function healthDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL não configurada');

  const url = new URL(base);
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('pool_timeout', '2');
  url.searchParams.set('socket_timeout', '2');

  return url.toString();
}
