// Fuso em que o negócio pensa as datas (APP_TIMEZONE do backend) — nunca o
// fuso do navegador de quem está olhando.
const APP_TIME_ZONE = 'America/Sao_Paulo'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// Data de calendário AAAA-MM-DD (vencimento): fatiar a string evita que um
// `new Date()` a interprete como meia-noite UTC e recue um dia.
export function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

// Instante ISO-8601 exibido só como data (DD/MM/AAAA) no fuso de São Paulo.
export function formatDate(isoInstant: string): string {
  return dateFormatter.format(new Date(isoInstant))
}

// Instante ISO-8601 exibido como data e hora no fuso de São Paulo.
export function formatDateTime(isoInstant: string): string {
  return dateTimeFormatter.format(new Date(isoInstant))
}
