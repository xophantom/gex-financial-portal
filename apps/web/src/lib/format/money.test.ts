import { describe, expect, it } from 'vitest'
import { formatBrl } from './money'

describe('formatBrl', () => {
  it('prefixes the Brazilian currency symbol', () => {
    expect(formatBrl(155313)).toBe('R$ 1.553,13')
    expect(formatBrl(1)).toBe('R$ 0,01')
  })
})
