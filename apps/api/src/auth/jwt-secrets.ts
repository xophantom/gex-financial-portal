// Falha rápida de propósito: um valor padrão aqui seria um segredo previsível
// e público (documentado no próprio repositório, em .env.example), o que
// permitiria forjar um token para qualquer usuário e qualquer papel contra
// qualquer deploy que esquecesse de configurar a env var — inclusive um
// token FINANCE capaz de aprovar e marcar solicitações como pagas. Preferível
// o processo nem subir do que servir tokens sob um segredo conhecido.
function requireEnv(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }

  return value;
}

// Funções, não constantes de módulo: precisam ler process.env no momento em
// que o Nest resolve o provider (compile()/create()), não em quando este
// arquivo é importado — testes só definem a env var depois de subir os
// containers descartáveis, e o import de AppModule acontece antes disso.
export function resolveJwtSecret(): string {
  return requireEnv('JWT_SECRET');
}

export function resolveJwtRefreshSecret(): string {
  return requireEnv('JWT_REFRESH_SECRET');
}
