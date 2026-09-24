// Endereço da API NestJS visto do servidor Next (BFF, proxy e Route
// Handlers) — o browser nunca fala com ela direto. Módulo próprio porque é
// lido tanto por client.ts quanto pelo refresh da sessão, que client.ts
// importa: morar em qualquer um dos dois criaria um ciclo de import.
export const API_BASE_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001'
