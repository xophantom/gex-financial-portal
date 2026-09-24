// Emitido depois de toda escrita que muda solicitações (criação, decisão,
// pagamento). Quem mantém visões derivadas, como o cache do dashboard, escuta
// este evento em vez de o módulo de solicitações conhecer cada uma delas.
export const REQUESTS_CHANGED = 'requests.changed'
