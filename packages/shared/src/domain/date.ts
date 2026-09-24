// Valida se uma string é uma data real no calendário.
// Apenas verificar o formato (YYYY-MM-DD) não é suficiente: datas como
// 2026-02-31 ou 2025-02-29 têm formato válido mas não existem.
// A solução é fazer o round-trip: parsear, serializar de volta e
// comparar com a entrada. Se foram feitos roll-overs (2026-02-31 -> 2026-03-03),
// o resultado não bate.
export const isCalendarDate = (value: string): boolean => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
