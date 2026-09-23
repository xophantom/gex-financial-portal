import { describe, expect, it } from 'vitest'
import { formatCompetence, parseCompetenceInput } from './competence.js'

describe('parseCompetenceInput', () => {
  it('accepts the Brazilian display format', () => {
    expect(parseCompetenceInput('09/2026')).toBe('2026-09')
  })

  it('accepts the stored format unchanged', () => {
    expect(parseCompetenceInput('2026-09')).toBe('2026-09')
  })

  it.each(['13/2026', '2026-13', '00/2026', '2026-00'])(
    'rejects the impossible month in %s',
    (input) => {
      expect(() => parseCompetenceInput(input)).toThrow()
    },
  )

  it.each(['9/2026', '09/26', '2026/09', '', 'setembro'])(
    'rejects malformed input %s',
    (input) => {
      expect(() => parseCompetenceInput(input)).toThrow()
    },
  )

  it('trims leading and trailing whitespace', () => {
    expect(parseCompetenceInput(' 09/2026 ')).toBe('2026-09')
  })

  it('trims trailing newlines', () => {
    expect(parseCompetenceInput('2026-09\n')).toBe('2026-09')
  })

  // O intervalo de anos (0000–9999) corresponde à constraint CHECK do banco:
  // CHECK (competence ~ '^\d{4}-(0[1-9]|1[0-2])$').
  // A validação no código compartilhado mantém-se idêntica à do banco.
  it('accepts year range 0000–9999 to match database constraint', () => {
    expect(parseCompetenceInput('0000-01')).toBe('0000-01')
    expect(parseCompetenceInput('9999-12')).toBe('9999-12')
  })
})

describe('formatCompetence', () => {
  it('renders the stored value for display', () => {
    expect(formatCompetence('2026-09')).toBe('09/2026')
  })

  it('round-trips', () => {
    expect(parseCompetenceInput(formatCompetence('2026-01'))).toBe('2026-01')
  })

  it.each(['13/2026', '2026-13', ''])(
    'throws for invalid stored format %s',
    (input) => {
      expect(() => formatCompetence(input)).toThrow()
    },
  )
})
