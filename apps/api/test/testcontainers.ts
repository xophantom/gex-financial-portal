import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | undefined;

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
