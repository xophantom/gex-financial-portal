// Só dígitos e os caracteres da máscara (. / - e espaços): sem isto,
// "abc10000000000145xyz" viraria um CNPJ válido depois de normalizado.
const CNPJ_INPUT = /^[\d./\-\s]*$/

export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, '')
}

function checkDigit(digits: number[]): number {
  let weight = digits.length === 12 ? 5 : 6
  let sum = 0

  for (const digit of digits) {
    sum += digit * weight
    weight = weight === 2 ? 9 : weight - 1
  }

  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCnpj(input: string): boolean {
  if (!CNPJ_INPUT.test(input)) return false

  const digits = normalizeCnpj(input)

  if (!/^\d{14}$/.test(digits)) return false
  // Sequências de dígito único passam no cálculo do verificador mas não são
  // CNPJ emitido; 00000000000000 é o caso que mais aparece em formulário.
  if (/^(\d)\1{13}$/.test(digits)) return false

  const numbers = digits.split('').map(Number)
  const base = numbers.slice(0, 12)
  const first = checkDigit(base)
  const second = checkDigit([...base, first])

  return numbers[12] === first && numbers[13] === second
}

export function formatCnpj(digits: string): string {
  return normalizeCnpj(digits).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
