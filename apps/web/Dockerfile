# syntax=docker/dockerfile:1

# Mesmo raciocínio do Dockerfile da API: build a partir da raiz do monorepo
# porque @gex/web depende de @gex/shared via workspace:*.
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# @gex/shared compilado antes do build do Next: as Server Components
# importam formatação de dinheiro/CNPJ de `@gex/shared`, que resolve para
# `packages/shared/dist` via seu package.json — sem isso o build falha
# procurando um dist/ que ainda não existe.
RUN pnpm --filter @gex/shared build
RUN pnpm --filter @gex/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# next.config.ts define outputFileTracingRoot para a raiz do monorepo, então
# o output standalone já traz consigo só os arquivos de node_modules (e de
# @gex/shared) que o servidor realmente usa — nada de reconstruir symlinks
# do pnpm à mão aqui.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
