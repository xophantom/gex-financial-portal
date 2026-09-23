import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatCentsToBrl, parseBrlToCents } from './money'

const expected = JSON.parse(
  readFileSync(new URL('../../../data/expected_results.json', import.meta.url), 'utf8'),
) as { money_parse_examples: Record<string, number> }

describe('parseBrlToCents', () => {
  it.each(Object.entries(expected.money_parse_examples))(
    'converts %s to %i cents',
    (input, cents) => {
      expect(parseBrlToCents(input)).toBe(cents)
    },
  )

  it('completes a single decimal place to two', () => {
    expect(parseBrlToCents('1553,1')).toBe(155310)
  })

  it('accepts a plain integer as reais, not cents', () => {
    expect(parseBrlToCents('10')).toBe(1000)
  })

  it.each(['0', '0,00', '-5,00', '1,234', 'abc', '', '  ', '1.2.3,45'])(
    'rejects %s',
    (input) => {
      expect(() => parseBrlToCents(input)).toThrow()
    },
  )

  it('never loses a cent to binary floating point', () => {
    expect(parseBrlToCents('0,07')).toBe(7)
    expect(parseBrlToCents('1234567,89')).toBe(123456789)
  })

  it('distinguishes magnitude overflow from zero/negative values', () => {
    const error = expect(() => parseBrlToCents('90071992547409929,00')).toThrow()
    error.toHaveProperty('message', expect.stringContaining('limite suportado'))
  })
})

describe('formatCentsToBrl', () => {
  it.each([
    [155313, '1.553,13'],
    [1, '0,01'],
    [1000, '10,00'],
    [123456789, '1.234.567,89'],
  ])('formats %i as %s', (cents, text) => {
    expect(formatCentsToBrl(cents)).toBe(text)
  })

  it('round-trips through the parser', () => {
    for (const cents of [1, 7, 1000, 155313, 123456789]) {
      expect(parseBrlToCents(formatCentsToBrl(cents))).toBe(cents)
    }
  })

  it('rejects non-safe integers', () => {
    expect(() => formatCentsToBrl(100.5)).toThrow()
    expect(() => formatCentsToBrl(NaN)).toThrow()
    expect(() => formatCentsToBrl(Infinity)).toThrow()
    expect(() => formatCentsToBrl(-Infinity)).toThrow()
  })

  it('formats zero and negative values correctly', () => {
    expect(formatCentsToBrl(0)).toBe('0,00')
    expect(formatCentsToBrl(-5)).toBe('-0,05')
  })
})
