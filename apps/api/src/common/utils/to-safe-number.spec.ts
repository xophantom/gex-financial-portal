import { toSafeNumber } from './to-safe-number'

describe('toSafeNumber', () => {
  it('converts a BigInt to a number', () => {
    expect(toSafeNumber(125000n)).toBe(125000)
  })

  it('converts boundary-safe values instead of throwing', () => {
    expect(toSafeNumber(0n)).toBe(0)
    expect(toSafeNumber(-1n)).toBe(-1)
    expect(toSafeNumber(9007199254740991n)).toBe(Number.MAX_SAFE_INTEGER)
    expect(toSafeNumber(-9007199254740991n)).toBe(Number.MIN_SAFE_INTEGER)
  })

  it('throws when a BigInt exceeds the safe integer range', () => {
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(/safe integer/i)
    expect(() => toSafeNumber(2n ** 60n)).toThrow(/safe integer/i)
  })

  it('throws when a BigInt is below the negative safe integer range', () => {
    expect(() => toSafeNumber(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toThrow(/safe integer/i)
    expect(() => toSafeNumber(-(2n ** 60n))).toThrow(/safe integer/i)
  })
})
