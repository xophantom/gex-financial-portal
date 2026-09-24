# syntax=docker/dockerfile:1

# Build multi-stage a partir da raiz do monorepo (o `context: .` no Compose):
# @gex/api depende de @gex/shared via workspace:*, e o pnpm resolve isso com
# symlinks que só existem se o install rodar com o pnpm-workspace.yaml e os
# manifests de todos os pacotes visíveis, não só os de apps/api.
FROM node:22-alpine AS base
# libssl é exigido pelo query engine do Prisma no Alpine (musl); sem isso o
# client falha ao carregar em runtime com "Unable to require libquery_engine".
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable

FROM base AS deps
WORKDIR /app
# Só os manifests primeiro: essa camada fica em cache entre builds enquanto
# só código-fonte muda, sem invalidar o `pnpm install` inteiro a cada rebuild.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# `prisma generate` primeiro: requests.repository.ts importa os tipos do
# client gerado, e o build do Nest falha sem eles existirem ainda.
RUN pnpm --filter @gex/api exec prisma generate
# @gex/shared precisa estar compilado (packages/shared/dist) antes do build
# da API — o `prebuild` de @gex/api já faz isso, mas chamamos explícito
# porque foi exatamente essa ordem, quebrada, que gerou um
# ERR_MODULE_NOT_FOUND procurando src/money.js num container real (Task 10).
RUN pnpm --filter @gex/shared build
RUN pnpm --filter @gex/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Copiamos a árvore de build inteira, node_modules incluído, em vez de
# tentar recriar seletivamente a estrutura de symlinks que o pnpm monta para
# um workspace — errar essa reconstrução manualmente é exatamente a classe
# de defeito ("builda mas não starta") que a Task 22 existe para evitar. O
# custo é uma imagem maior; a garantia é que o que roda aqui é o que foi
# buildado e testado no estágio anterior, byte a byte.
COPY --from=build /app /app
WORKDIR /app/apps/api

EXPOSE 3001

# `prisma migrate deploy` aplica as migrations pendentes; o seed é
# idempotente (upsert por id) e pode rodar em toda subida sem duplicar
# dados. `node dist/prisma/seed.js` — não `tsx prisma/seed.ts` — porque o
# `nest build` já compilou o seed para dist/ junto com o resto (prisma/
# entra na compilação por importar tipos do client). `node dist/src/main`,
# não `node dist/main`, pelo mesmo motivo: prisma/seed.ts dentro da
# compilação move a raiz comum do TypeScript um nível para baixo.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main"]
