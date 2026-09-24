# Portal de Solicitações Financeiras

[![CI](https://github.com/xophantom/gex-financial-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/xophantom/gex-financial-portal/actions/workflows/ci.yml)

Teste técnico GEX — Fullstack Sênior. Solicitante cadastra uma despesa; o time
financeiro aprova, rejeita ou marca como paga.

## Como subir

```bash
docker compose up --build
```

Nenhum `.env` é necessário — todo valor tem default embutido no
`docker-compose.yml`, incluindo `APP_TODAY=2026-09-18`, a data de referência
usada para os números abaixo.

| Serviço      | URL                            |
| ------------ | ------------------------------- |
| Web          | http://localhost:3000           |
| API          | http://localhost:3001           |
| Documentação | http://localhost:3001/docs      |
| Jaeger       | http://localhost:16686          |

## Usuários de seed

| E-mail                       | Senha              | Perfil     | Pode                                          |
| ----------------------------- | ------------------ | ---------- | ---------------------------------------------- |
| `solicitante@gex.test`        | `GexRequester123!` | REQUESTER  | Criar solicitações e ver só as próprias        |
| `outro.solicitante@gex.test`  | `GexRequester456!` | REQUESTER  | Idem — usado para provar isolamento entre solicitantes |
| `financeiro@gex.test`         | `GexFinance123!`   | FINANCE    | Ver todas, aprovar, rejeitar e marcar como paga |

## Dashboard esperado

Com `APP_TODAY=2026-09-18` (o default do Compose), o perfil `FINANCE` deve ver:

| Indicador              | Valor esperado |
| ----------------------- | -------------: |
| Total pendente          |    R$ 8.750,49 |
| Total aprovado          |    R$ 6.585,99 |
| Pago no mês             |    R$ 8.415,49 |
| Solicitações vencidas   |              4 |

## Como testar

```bash
pnpm test                          # unitários: @gex/shared, @gex/web, @gex/api
pnpm --filter @gex/api test:e2e    # integração com Postgres real via Testcontainers (exige Docker)
pnpm demo:concurrency               # prova de concorrência contra o stack rodando
```

`pnpm demo:concurrency` dispara 8 criações idênticas e, em seguida, 8
aprovações simultâneas da mesma solicitação contra a API em
`http://localhost:3001` (ou `API_URL`, se definida). O resultado esperado é
`1× 201` e `7× 409` na criação, e `1× 200`, `7× 409` e exatamente 1 evento
`APPROVED` gravado na aprovação — prova, rodando no terminal de quem avalia,
que o índice único do banco e o `SELECT ... FOR UPDATE` arbitram a corrida em
vez de deixar duas requisições concorrentes criarem ou aprovarem em duplicado.

## Decisões e trade-offs

- **Dinheiro em centavos, sempre.** `amount_cents` é inteiro do formulário ao
  banco (`BIGINT`); nenhuma camada usa `float`/`double`, então não há erro de
  arredondamento acumulado.
- **`DATE` para vencimento e competência**, não `TIMESTAMP`: a data de um
  boleto não muda por causa de fuso horário. `APP_TIMEZONE` só entra na
  exibição e no cálculo de "vencido"/"pago no mês".
- **`SELECT ... FOR UPDATE`, não lock otimista.** A janela de disputa (duas
  aprovações quase simultâneas) é curta e rara; travar a linha durante a
  transição é mais simples de raciocinar do que retry com `version` e
  reconciliar o que fazer quando ele falha.
- **Redis nunca é fonte de verdade.** Cacheia o resumo do dashboard e guarda
  chaves de idempotência; some do ar e a API cai para `degraded`, nunca para
  dado incorreto — a garantia de unicidade (CNPJ + nota) mora no índice único
  do Postgres, não no cache.
- **404, não 403, para solicitação de outra pessoa.** Um `REQUESTER`
  consultando o registro de outro solicitante recebe "não encontrado": o
  escopo entra no `WHERE` da consulta, então o registro alheio simplesmente
  não existe para quem pergunta. Evita confirmar a existência de um recurso
  que o usuário não deveria nem saber que existe.
- **Sem fila de mensagens.** Todo fluxo (criar, decidir, marcar como pago) é
  uma operação síncrona de request/resposta protegida por uma transação
  Postgres; não há passo lento nem trabalho a desacoplar que justifique o
  custo operacional de um broker.
- **`@tanstack/react-query` foi removido** por não ter uso: todo Server
  Component busca dado com `cache: 'no-store'`, então não existe cache de
  cliente para gerenciar, e uma mutação chama `router.refresh()` para
  invalidar direto na fonte. Zustand (toasts, diálogo de decisão) e nuqs
  (filtros na URL) continuam, porque resolvem um problema real que o
  React Query não resolveria melhor.
