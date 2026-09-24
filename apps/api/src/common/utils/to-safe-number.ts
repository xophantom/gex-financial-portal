// Converte explicitamente na montagem de cada resposta (valores em centavos,
// somatórios e contagens do Postgres chegam como BigInt) em vez de deixar a
// conversão para a borda HTTP: o contrato de @gex/shared diz `number`, e o
// cache do dashboard e a idempotência gravam o mesmo objeto em JSON, que não
// serializa BigInt.
//
// Estourar em silêncio seria pior que lançar: Number(bigint) arredonda acima
// de 2^53, e um valor truncado vira dinheiro errado que ninguém percebe,
// enquanto a exceção aparece no primeiro teste. O limite é simétrico porque
// nada garante que todo BigInt venha de uma coluna com constraint de
// positividade como amount_cents.
export function toSafeNumber(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error(`Value ${value} exceeds the safe integer range`);
  }
  return Number(value);
}
