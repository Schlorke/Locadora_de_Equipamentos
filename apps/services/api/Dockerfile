# syntax=docker/dockerfile:1
# Contexto: raiz do workspace. Nenhum .env entra na imagem (.dockerignore).
FROM node:24.21-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm db:generate && pnpm --filter @gb-locacoes/api build

FROM node:24.21-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production PORT=3002 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/apps/services/api/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/services/api/.next/static ./apps/services/api/.next/static
USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3002/api/health || exit 1
CMD ["node", "apps/services/api/server.js"]
