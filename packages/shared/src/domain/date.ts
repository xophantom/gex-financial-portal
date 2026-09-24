// Data real no calendário, não só no formato: 2026-02-31 viraria 2026-03-03
// ao ser interpretada, então o round-trip parse/serialize não bate.
export const isCalendarDate = (value: string): boolean => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
