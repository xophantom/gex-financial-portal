import { Injectable } from '@nestjs/common';
import { isCalendarDate } from '@gex/shared';
import { dateInZone } from '../common/timezone';

const CALENDAR_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

@Injectable()
export class ClockService {
  private readonly fixedToday?: string;
  private readonly zone: string;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.zone = env.APP_TIMEZONE ?? 'America/Sao_Paulo';
    this.fixedToday = env.APP_TODAY;

    if (this.fixedToday) {
      if (!CALENDAR_DATE.test(this.fixedToday)) {
        throw new Error(
          `APP_TODAY must be YYYY-MM-DD, received: ${this.fixedToday}`,
        );
      }
      if (!isCalendarDate(this.fixedToday)) {
        throw new Error(
          `APP_TODAY does not exist in the calendar: ${this.fixedToday}`,
        );
      }
    }
  }

  today(): string {
    if (this.fixedToday) return this.fixedToday;

    return dateInZone(new Date(), this.zone);
  }

  currentMonth(): string {
    return this.today().slice(0, 7);
  }

  timezone(): string {
    return this.zone;
  }
}
