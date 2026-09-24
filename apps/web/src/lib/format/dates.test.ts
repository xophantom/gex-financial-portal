import { describe, expect, it } from 'vitest'
import { formatCalendarDate, formatDate, formatDateTime } from './dates'

describe('date formatters', () => {
  it('formats a calendar date without shifting the day', () => {
    expect(formatCalendarDate('2026-09-01')).toBe('01/09/2026')
  })

  it('formats an instant as a São Paulo date', () => {
    // 01:30 UTC ainda é o dia anterior em São Paulo (UTC-3).
    expect(formatDate('2026-09-02T01:30:00.000Z')).toBe('01/09/2026')
  })

  it('formats an instant as São Paulo date and time', () => {
    expect(formatDateTime('2026-09-02T01:30:00.000Z')).toBe('01/09/2026, 22:30')
  })
})
