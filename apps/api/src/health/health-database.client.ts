import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// PrismaService (a instância @Global() usada pelo resto da aplicação) fica
// de fora do probe de saúde de propósito. Duas razões, as duas reais
// (fix round 1, Finding 2):
//
// 1. Sob carga real, se o pool da aplicação estiver saturado, a query do
//    probe entraria na mesma fila — e como qualquer query, poderia passar
//    de 1.5s (HEALTH_CHECK_TIMEOUT_MS) só por causa da fila, não porque o
//    banco está fora do ar. Isso reportaria `database: down` (e o
//    healthcheck do Compose reiniciaria uma API cujo banco está
//    perfeitamente saudável) exatamente quando o sistema está sob mais
//    pressão.
// 2. Contra um socket congelado (`docker pause`), a query nunca retorna —
//    `withTimeout` limita a RESPOSTA do endpoint, mas não cancela a query
//    por baixo: ela continua presa segurando a conexão que a tirou do
//    pool. Se o probe usasse o pool da aplicação, cada poll de um
//    healthcheck durante uma indisponibilidade vazaria mais uma conexão
//    do pool que atende tráfego real, até esgotá-lo.
//
// A saída: uma conexão dedicada, deliberadamente mínima —
// connection_limit=1 significa que o pior caso vaza NO MÁXIMO 1 conexão,
// nunca o pool inteiro da aplicação — e socket_timeout=2 faz o próprio
// engine do Prisma desistir e derrubar o socket preso após 2s, em vez de
// mantê-lo pendurado para sempre. Isso limita o vazamento a, no máximo, 1
// conexão morta por vez (reciclada a cada 2s), não 1 por poll acumulando
// sem limite. connection_limit=1/socket_timeout=2 são maiores que o
// HEALTH_CHECK_TIMEOUT_MS de 1.5s do controller — o timeout do lado da
// aplicação sempre vence primeiro para responder rápido; o socket_timeout
// existe para o engine liberar o recurso um pouco depois, não para
// definir a latência percebida pelo chamador.
//
// Tradeoff assumido, não escondido: isto tem o custo de manter mais uma
// conexão TCP com o Postgres, sempre. Considerado aceitável porque é
// única, constante e desacoplada — o preço de qualquer alternativa
// (reabrir uma conexão a cada poll) seria pior (latência de handshake TLS/
// TCP a cada /health, e o mesmo risco de conexões penduradas se cada nova
// tentativa também travasse). Redis não recebeu o mesmo tratamento: é uma
// única conexão já compartilhada por toda a aplicação (rate limit,
// idempotência, cache), não um pool — o ping do probe não briga por uma
// vaga entre várias, é só mais um comando na mesma fila que já existe
// independentemente do /health existir.
@Injectable()
export class HealthDatabaseClient
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor() {
    super({ datasources: { db: { url: healthDatabaseUrl() } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function healthDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL não configurada');

  const url = new URL(base);
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('pool_timeout', '2');
  url.searchParams.set('socket_timeout', '2');

  return url.toString();
}
