import { describe, expect, it } from 'vitest'
import { isCalendarDate } from './date.js'

describe('isCalendarDate', () => {
  it('rejects impossible dates', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2026-04-31')).toBe(false)
    expect(isCalendarDate('2025-02-29')).toBe(false)
    expect(isCalendarDate('9999-99-99')).toBe(false)
  })

  it('accepts real dates including leap days', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-09-18')).toBe(true)
  })
})
