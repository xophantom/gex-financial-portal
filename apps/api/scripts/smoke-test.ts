import { spawn, spawnSync } from 'node:child_process';

// Nenhum teste unitário ou e2e passa por isto: todos rodam sob um transpiler
// (ts-jest), que tolera exatamente os dois jeitos de o binário compilado
// quebrar — path de entrada errado e um pacote workspace apontando para
// TypeScript fonte. Este script builda de verdade, sobe o `node dist/...`
// real e bate numa rota real, porque só assim esses dois defeitos aparecem.

const PORT = process.env.API_PORT ?? '3099';
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://gex:gex_local_password@localhost:5432/gex_finance_test';
const APP_TODAY = process.env.APP_TODAY ?? '2026-09-18';
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';
// AuthModule recusa subir sem os dois segredos JWT.
const JWT_SECRET = process.env.JWT_SECRET ?? 'smoke-test-jwt-secret';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'smoke-test-jwt-refresh-secret';
const CORRELATION_ID = `smoke-${Date.now()}`;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BOOT_TIMEOUT_MS = 20_000;

interface LoggedLine {
  correlationId?: string;
  msg?: string;
}

class SmokeTestError extends Error {}

function fail(message: string): never {
  throw new SmokeTestError(message);
}

function runBuild(): void {
  console.log('[smoke] pnpm run build (builds @gex/shared first via prebuild)');
  const result = spawnSync('pnpm', ['run', 'build'], { stdio: 'inherit' });
  if (result.status !== 0) {
    fail('build failed; see output above');
  }
}

function parseLines(raw: string[]): LoggedLine[] {
  const parsed: LoggedLine[] = [];
  for (const line of raw) {
    try {
      parsed.push(JSON.parse(line) as LoggedLine);
    } catch {
      // linha não-JSON (ex.: stack trace impresso à parte); ignorada de
      // propósito, não é isso que este script verifica.
    }
  }
  return parsed;
}

async function waitForBoot(lines: string[]): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < BOOT_TIMEOUT_MS) {
    const booted = parseLines(lines).some((line) =>
      line.msg?.includes('Nest application successfully started'),
    );
    if (booted) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail(
    `the app never logged "Nest application successfully started" within ${BOOT_TIMEOUT_MS}ms`,
  );
}

async function waitForCorrelatedLine(
  lines: string[],
  timeoutMs = 2_000,
): Promise<LoggedLine | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = parseLines(lines).find(
      (line) => line.correlationId === CORRELATION_ID,
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

async function main(): Promise<void> {
  runBuild();

  console.log(`[smoke] booting node dist/src/main on port ${PORT}`);
  const lines: string[] = [];
  const child = spawn('node', ['dist/src/main'], {
    env: {
      ...process.env,
      DATABASE_URL,
      API_PORT: PORT,
      APP_TODAY,
      APP_TIMEZONE,
      JWT_SECRET,
      JWT_REFRESH_SECRET,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    process.stdout.write(text);
    for (const line of text.split('\n')) {
      if (line.length > 0) lines.push(line);
    }
  });

  try {
    await waitForBoot(lines);

    console.log(
      `[smoke] GET /rota-inexistente with x-correlation-id: ${CORRELATION_ID}`,
    );
    const response = await fetch(`${BASE_URL}/rota-inexistente`, {
      headers: { 'x-correlation-id': CORRELATION_ID },
    });

    if (response.status !== 404) {
      fail(`expected status 404, got ${response.status}`);
    }

    const echoedHeader = response.headers.get('x-correlation-id');
    if (echoedHeader !== CORRELATION_ID) {
      fail(
        `expected the response to echo x-correlation-id: ${CORRELATION_ID}, got: ${String(echoedHeader)}`,
      );
    }

    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    if (body.error?.code !== 'NOT_FOUND') {
      fail(
        `expected error.code to be NOT_FOUND in the response envelope, got: ${JSON.stringify(body)}`,
      );
    }

    // pino-http grava a linha "request completed" no fim da resposta, o que
    // corre em paralelo com o fetch() do lado de cá recebendo essa mesma
    // resposta — sem essa espera curta, a checagem roda antes de a linha
    // atravessar o pipe do processo filho.
    const correlatedLine = await waitForCorrelatedLine(lines);
    if (!correlatedLine) {
      fail(
        `no log line carried correlationId "${CORRELATION_ID}" — the request and the log are not correlated`,
      );
    }

    console.log(
      '[smoke] OK: sanitised 404 envelope + correlated log line, both confirmed',
    );
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error: unknown) => {
  if (error instanceof SmokeTestError) {
    console.error(`[smoke] FAIL: ${error.message}`);
  } else {
    console.error('[smoke] FAIL: unexpected error');
    console.error(error);
  }
  process.exit(1);
});
