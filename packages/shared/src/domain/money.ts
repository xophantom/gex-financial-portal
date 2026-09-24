const BRL_PATTERN = /^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/

export function parseBrlToCents(input: string): number {
  const cleaned = input.replace(/\s/g, '').replace(/^R\$/i, '')

  if (!BRL_PATTERN.test(cleaned)) {
    throw new Error(`Valor monetário inválido: ${input}`)
  }

  const [reais, decimals = ''] = cleaned.split(',')
  // Centavos são construídos a partir dos dígitos, nunca por multiplicação de
  // ponto flutuante: 15.53 * 100 é 1552.9999999999998 em IEEE 754.
  const cents = Number(`${reais.replace(/\./g, '')}${decimals.padEnd(2, '0')}`)

  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Valor acima do limite suportado: ${input}`)
  }

  if (cents <= 0) {
    throw new Error(`Valor deve ser maior que zero: ${input}`)
  }

  return cents
}

export function formatCentsToBrl(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Centavos inválido: ${cents}`)
  }

  const sign = cents < 0 ? '-' : ''
  const digits = String(Math.abs(cents)).padStart(3, '0')
  const reais = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${sign}${reais},${digits.slice(-2)}`
}
