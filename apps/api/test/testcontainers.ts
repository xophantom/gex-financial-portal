import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

let container: StartedPostgreSqlContainer | undefined;
let redisContainer: StartedRedisContainer | undefined;

export async function startTestDatabase(): Promise<string> {
  container = await new PostgreSqlContainer('postgres:16.4-alpine').start();
  const url = container.getConnectionUri();

  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  return url;
}

export async function stopTestDatabase(): Promise<void> {
  await container?.stop();
}

// StartedTestContainer (testcontainers 12.1.0) não expõe pause()/unpause();
// `docker pause`/`unpause` no id do container real produz o mesmo efeito —
// congela o processo sem derrubar a porta mapeada nem o container em si —
// que basta para simular indisponibilidade sem recriar o container nem
// perder seu estado.
export function pauseTestDatabase(): void {
  if (!container) throw new Error('test database container is not running');
  execSync(`docker pause ${container.getId()}`);
}

export function unpauseTestDatabase(): void {
  if (!container) throw new Error('test database container is not running');
  execSync(`docker unpause ${container.getId()}`);
}

export async function startTestRedis(): Promise<string> {
  redisContainer = await new RedisContainer('redis:7-alpine').start();
  return redisContainer.getConnectionUrl();
}

export async function stopTestRedis(): Promise<void> {
  await redisContainer?.stop();
}

export function pauseTestRedis(): void {
  if (!redisContainer) throw new Error('test redis container is not running');
  execSync(`docker pause ${redisContainer.getId()}`);
}

export function unpauseTestRedis(): void {
  if (!redisContainer) throw new Error('test redis container is not running');
  execSync(`docker unpause ${redisContainer.getId()}`);
}
