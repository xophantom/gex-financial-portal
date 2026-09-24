# syntax=docker/dockerfile:1

# Build a partir da raiz do monorepo: @gex/web depende de @gex/shared via
# workspace:*.
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
# @gex/shared resolve para packages/shared/dist, que precisa existir antes
# do build do Next.
RUN pnpm --filter @gex/shared build
RUN pnpm --filter @gex/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# O output standalone (outputFileTracingRoot na raiz do monorepo) já traz só
# o que o servidor usa, @gex/shared incluído.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
