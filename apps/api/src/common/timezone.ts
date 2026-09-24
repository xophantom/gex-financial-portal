export function offsetFor(isoDate: string, zone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longOffset',
  });

  const part = formatter
    .formatToParts(new Date(`${isoDate}T12:00:00Z`))
    .find((candidate) => candidate.type === 'timeZoneName');

  // 'GMT-03:00' -> '-03:00'. Calcular em vez de fixar -03:00 mantém a conta
  // correta se a data cair sob horário de verão.
  return part?.value.replace('GMT', '') || '+00:00';
}
