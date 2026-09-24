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
# O build do Nest precisa dos tipos do client Prisma gerado e de
# packages/shared/dist já compilado.
RUN pnpm --filter @gex/api exec prisma generate
RUN pnpm --filter @gex/shared build
RUN pnpm --filter @gex/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Copia a árvore de build inteira, node_modules incluído: recriar à mão os
# symlinks do workspace pnpm é frágil. Custa uma imagem maior.
COPY --from=build /app /app
WORKDIR /app/apps/api

EXPOSE 3001

# Migrations pendentes + seed (só cria o que falta, então pode rodar a cada
# subida sem desfazer mudanças) + API. O seed fica fora do build do Nest e
# roda do fonte com tsx, que já está no node_modules copiado acima; o npx só
# resolve os binários locais, sem baixar nada.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/main"]
