import { Injectable } from '@nestjs/common'
import { isCalendarDate } from '@gex/shared'

const CALENDAR_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

@Injectable()
export class ClockService {
  private readonly fixedToday?: string
  private readonly zone: string

  constructor(env: Record<string, string | undefined> = process.env) {
    this.zone = env.APP_TIMEZONE ?? 'America/Sao_Paulo'
    this.fixedToday = env.APP_TODAY

    if (this.fixedToday) {
      if (!CALENDAR_DATE.test(this.fixedToday)) {
        throw new Error(`APP_TODAY must be YYYY-MM-DD, received: ${this.fixedToday}`)
      }
      if (!isCalendarDate(this.fixedToday)) {
        throw new Error(`APP_TODAY does not exist in the calendar: ${this.fixedToday}`)
      }
    }
  }

  today(): string {
    if (this.fixedToday) return this.fixedToday

    // en-CA formata como YYYY-MM-DD, que é exatamente o formato de comparação
    // usado contra a coluna DATE — evita construir a string à mão.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  }

  currentMonth(): string {
    return this.today().slice(0, 7)
  }

  now(): Date {
    return new Date()
  }

  timezone(): string {
    return this.zone
  }
}
