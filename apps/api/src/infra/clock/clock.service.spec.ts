import { ClockService } from './clock.service'

describe('ClockService', () => {
  it('uses APP_TODAY when it is defined', () => {
    const clock = new ClockService({
      APP_TODAY: '2026-09-18',
      APP_TIMEZONE: 'America/Sao_Paulo',
    })

    expect(clock.today()).toBe('2026-09-18')
    expect(clock.currentMonth()).toBe('2026-09')
  })

  it('falls back to the current date in the configured timezone', () => {
    const clock = new ClockService({ APP_TIMEZONE: 'America/Sao_Paulo' })
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    expect(clock.today()).toBe(expected)
  })

  it('defaults the timezone to America/Sao_Paulo', () => {
    expect(new ClockService({}).timezone()).toBe('America/Sao_Paulo')
  })

  it('rejects an APP_TODAY that is not a calendar date', () => {
    expect(() => new ClockService({ APP_TODAY: '18/09/2026' })).toThrow()
    expect(() => new ClockService({ APP_TODAY: '2026-13-01' })).toThrow()
    expect(() => new ClockService({ APP_TODAY: '2026-02-30' })).toThrow()
    expect(() => new ClockService({ APP_TODAY: '2026-04-31' })).toThrow()
    expect(() => new ClockService({ APP_TODAY: '2025-02-29' })).toThrow()
  })

  it('accepts valid dates including leap days', () => {
    expect(() => new ClockService({ APP_TODAY: '2024-02-29' })).not.toThrow()
    expect(() => new ClockService({ APP_TODAY: '2026-09-18' })).not.toThrow()
  })
})
