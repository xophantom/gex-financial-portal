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

| Serviço      | URL                        |
| ------------ | -------------------------- |
| Web          | http://localhost:3000      |
| API          | http://localhost:3001      |
| Documentação | http://localhost:3001/docs |
| Jaeger       | http://localhost:16686     |

## Usuários de seed

| E-mail                       | Senha              | Perfil    | Pode                                                   |
| ---------------------------- | ------------------ | --------- | ------------------------------------------------------ |
| `solicitante@gex.test`       | `GexRequester123!` | REQUESTER | Criar solicitações e ver só as próprias                |
| `outro.solicitante@gex.test` | `GexRequester456!` | REQUESTER | Idem — usado para provar isolamento entre solicitantes |
| `financeiro@gex.test`        | `GexFinance123!`   | FINANCE   | Ver todas, aprovar, rejeitar e marcar como paga        |

## Dashboard esperado

Com `APP_TODAY=2026-09-18` (o default do Compose), o perfil `FINANCE` deve ver:

| Indicador             | Valor esperado |
| --------------------- | -------------: |
| Total pendente        |    R$ 8.750,49 |
| Total aprovado        |    R$ 6.585,99 |
| Pago no mês           |    R$ 8.415,49 |
| Solicitações vencidas |              4 |

## Como testar

```bash
pnpm test                          # unitários: @gex/shared, @gex/web, @gex/api
pnpm lint && pnpm format:check     # ESLint e Prettier (config única na raiz)
pnpm --filter @gex/api test:e2e    # integração com Postgres real via Testcontainers (exige Docker)
pnpm demo:concurrency              # prova de concorrência contra o stack rodando
```

`pnpm demo:concurrency` dispara 8 criações idênticas e, em seguida, 8
aprovações simultâneas da mesma solicitação contra a API em
`http://localhost:3001` (ou `API_URL`, se definida). O resultado esperado é
`1× 201` e `7× 409` na criação, e `1× 200`, `7× 409` e exatamente 1 evento
`APPROVED` gravado na aprovação — prova, rodando no terminal de quem avalia,
que o índice único do banco e o `SELECT ... FOR UPDATE` arbitram a corrida em
vez de deixar duas requisições concorrentes criarem ou aprovarem em duplicado.

## Estrutura

```text
apps/api/
  prisma/               schema, migrations e seed
  src/
    auth/               login, JWT, guards e decorators de perfil
    requests/           solicitações: listagem, criação, decisão, pagamento e auditoria
    dashboard/          indicadores agregados por perfil
    health/             liveness de banco e Redis
    common/             erros, pipes/middleware HTTP, logging e utilitários
    infra/              Prisma, Redis, relógio (APP_TODAY) e telemetria
  test/                 e2e contra Postgres e Redis reais (Testcontainers)
  scripts/smoke-test.ts sobe o build compilado e confere o boot
apps/web/src/
  app/                  rotas (App Router) e o BFF em app/api, que guarda o JWT em cookie httpOnly
  components/           ui/ (primitivos) e layout/ (navegação)
  features/             auth, dashboard e requests
  lib/                  cliente da API, sessão e formatação
packages/shared/src/
  domain/               dinheiro, CNPJ, competência, datas e máquina de status
  schemas/              validação Zod usada pela API e pelos formulários
  contracts/            formato das respostas HTTP e códigos de erro
data/                   dados do desafio, carregados pelo seed sem alteração
scripts/                demo de concorrência contra o stack rodando
```

Testes unitários ficam ao lado do código (`*.spec.ts` na API, `*.test.ts(x)`
no web e no shared).

## Decisões e trade-offs

- **Dinheiro em centavos, sempre.** `amount_cents` é inteiro do formulário ao
  banco (`BIGINT` com `CHECK > 0`); nenhuma camada usa `float`. Digitar no
  campo de valor desloca os dígitos como centavos; colar `1.553,13`,
  `R$ 2.000,00` ou `10` passa pelo mesmo parser testado em `@gex/shared`.
- **`DATE` para vencimento e competência**, não `TIMESTAMP`: a data de um
  boleto não muda com o fuso. `APP_TIMEZONE` só entra na exibição e nas regras
  de calendário ("vencida", "pago no mês").
- **Data de pagamento é um dado próprio**, informada como `AAAA-MM-DD`, gravada
  ao meio-dia de São Paulo e validada: não pode ser futura nem anterior à
  criação da solicitação.
- **Integridade no banco, não só na API.** Índice único em (CNPJ, nota) e
  `CHECK` para valor positivo, formato da competência, motivo na rejeição e
  data/referência no pagamento. O número da nota é normalizado (trim,
  maiúsculas) para `nf-1` e `NF-1` colidirem.
- **`SELECT ... FOR UPDATE`, não lock otimista.** Travar a linha durante a
  transição é mais simples de raciocinar do que retry com `version`; status e
  evento de auditoria são gravados na mesma transação.
- **404, não 403, para solicitação de outra pessoa.** O escopo entra no
  `WHERE`: o registro alheio não existe para quem pergunta.
- **Erros num envelope único** (`{ error: { code, message, details? } }`):
  422 para qualquer dado inválido, 409 para duplicidade ou transição inválida.
- **Redis é opcional.** Cacheia o dashboard, guarda chaves de idempotência e
  conta tentativas de login. Se cair, a API segue respondendo pelo banco
  (`/health` reporta `degraded`) e o rate limit de login falha aberto — o hash
  argon2 continua encarecendo força bruta. Limitação: invalidações perdidas
  durante a queda podem servir um resumo antigo por até 60 s após a volta.
- **Seed só cria o que falta.** Roda a cada subida do container sem desfazer
  aprovações ou pagamentos feitos durante a avaliação.
- **Sem TanStack Query.** Server Components buscam com `cache: 'no-store'` e
  mutações chamam `router.refresh()`, então não sobra cache de cliente para
  gerenciar. Zustand guarda toasts e o diálogo aberto; nuqs mantém filtros e
  página na URL (busca compartilhável, botão voltar funciona).
- **Observabilidade.** Logs estruturados (pino) com `x-correlation-id` e
  redação de credenciais e dados financeiros; traces OpenTelemetry visíveis no
  Jaeger.
