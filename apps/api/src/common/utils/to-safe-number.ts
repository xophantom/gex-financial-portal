// BigInt (centavos, somas e contagens do Postgres) vira number na montagem de
// cada resposta: o contrato de @gex/shared é `number` e o JSON do cache e da
// idempotência não serializa BigInt. Lança em vez de arredondar acima de 2^53,
// porque um valor truncado seria dinheiro errado sem ninguém notar.
export function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Value ${value} exceeds the safe integer range`)
  }
  return Number(value)
}
