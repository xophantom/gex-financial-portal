import { describe, expect, it } from 'vitest'
import { formatCompetence, parseCompetenceInput } from './competence'

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
})

describe('formatCompetence', () => {
  it('renders the stored value for display', () => {
    expect(formatCompetence('2026-09')).toBe('09/2026')
  })

  it('round-trips', () => {
    expect(parseCompetenceInput(formatCompetence('2026-01'))).toBe('2026-01')
  })
})
