import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatCnpj, isValidCnpj, normalizeCnpj } from './cnpj.js'

const seed = JSON.parse(
  readFileSync(new URL('../../../../data/seed_requests.json', import.meta.url), 'utf8'),
) as Array<{ supplier_cnpj: string }>

describe('normalizeCnpj', () => {
  it('strips the mask', () => {
    expect(normalizeCnpj('10.000.000/0001-45')).toBe('10000000000145')
  })

  it('leaves unmasked digits untouched', () => {
    expect(normalizeCnpj('10000000000145')).toBe('10000000000145')
  })
})

describe('isValidCnpj', () => {
  it('accepts every CNPJ present in the seed data', () => {
    for (const { supplier_cnpj } of seed) {
      expect(isValidCnpj(supplier_cnpj)).toBe(true)
    }
  })

  it('accepts a masked CNPJ', () => {
    expect(isValidCnpj('10.000.000/0001-45')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidCnpj('10000000000146')).toBe(false)
  })

  it.each(['00000000000000', '11111111111111', '99999999999999'])(
    'rejects the repeated-digit sequence %s',
    (input) => {
      expect(isValidCnpj(input)).toBe(false)
    },
  )

  it('accepts a mask with spaces', () => {
    expect(isValidCnpj(' 10.000.000 / 0001-45 ')).toBe(true)
  })

  it.each([
    'abc10000000000145xyz',
    '10000000000145a',
    '10_000_000_0001_45',
    '10.000.000/0001-45\n#',
  ])('rejects characters outside the mask in %j', (input) => {
    expect(isValidCnpj(input)).toBe(false)
  })

  it.each(['1000000000014', '100000000001455', '', 'abcdefghijklmn'])(
    'rejects malformed input %s',
    (input) => {
      expect(isValidCnpj(input)).toBe(false)
    },
  )
})

describe('formatCnpj', () => {
  it('applies the display mask', () => {
    expect(formatCnpj('10000000000145')).toBe('10.000.000/0001-45')
  })
})
