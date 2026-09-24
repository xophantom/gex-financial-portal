const STORED = /^(\d{4})-(0[1-9]|1[0-2])$/
const DISPLAY = /^(0[1-9]|1[0-2])\/(\d{4})$/

export function parseCompetenceInput(input: string): string {
  const trimmed = input.trim()

  if (STORED.test(trimmed)) return trimmed

  const display = DISPLAY.exec(trimmed)
  if (display) return `${display[2]}-${display[1]}`

  throw new Error(`Competência inválida: ${input}`)
}

export function formatCompetence(stored: string): string {
  const match = STORED.exec(stored)
  if (!match) throw new Error(`Competência inválida: ${stored}`)

  return `${match[2]}/${match[1]}`
}
