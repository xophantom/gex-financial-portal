// Sem valor padrão: um segredo previsível permitiria forjar tokens (inclusive
// FINANCE) em qualquer deploy que esquecesse a variável. Melhor não subir.
function requireEnv(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set`)
  }

  return value
}

// Funções, não constantes: leem process.env quando o Nest resolve o provider,
// porque os testes só definem as variáveis depois de importar o AppModule.
export function resolveJwtSecret(): string {
  return requireEnv('JWT_SECRET')
}

export function resolveJwtRefreshSecret(): string {
  return requireEnv('JWT_REFRESH_SECRET')
}
