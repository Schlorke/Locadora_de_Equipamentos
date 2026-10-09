# syntax=docker/dockerfile:1
# Imagem do host web em produção hoje: a raiz (app/ + lib/), com o mesmo `pnpm run build` do vercel.json.
# Node e pnpm seguem o package.json da raiz: "engines" (node >=24.21.0 <25) e "packageManager" (pnpm@10.27.0).
# Nenhum segredo entra na imagem: .env* fica fora do contexto (.dockerignore) e as variáveis de runtime
# (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL...) são passadas no `docker run`.
#   docker build -t gb-locacoes .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e NEXTAUTH_SECRET=... -e NEXTAUTH_URL=... gb-locacoes
# GET /api/health responde 200 quando o banco está acessível (o CI prova isso no job "docker").
# A saída standalone do Next exige `output: 'standalone'` no next.config.mjs, que ainda não existe; por isso o
# estágio final leva o workspace construído inteiro, somente leitura para o usuário da aplicação.

ARG NODE_IMAGE=node:24.21-alpine
ARG PNPM_VERSION=10.27.0

FROM ${NODE_IMAGE} AS base
# openssl para o Prisma; libc6-compat para binários nativos (SWC, lightningcss, sharp) em musl.
RUN apk add --no-cache libc6-compat openssl
ENV COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
# Manifestos do workspace antes do install, para `--frozen-lockfile` ver todos os importadores do lockfile.
# Um pacote novo em packages/* ou apps/clients/* precisa de uma linha aqui (o install falha sem ela).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/clients/web/package.json apps/clients/web/
COPY apps/clients/mobile/package.json apps/clients/mobile/
COPY apps/services/api/package.json apps/services/api/
COPY packages/backend/package.json packages/backend/
COPY packages/contracts/package.json packages/contracts/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/domain/package.json packages/domain/
COPY packages/frontend/package.json packages/frontend/
COPY packages/ui/package.json packages/ui/
# Como no CI: sem scripts de instalação (o `prepare` do husky exige .git); o Prisma Client é gerado no build.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV NODE_OPTIONS=--max-old-space-size=6144
COPY --from=deps /app ./
COPY . .
# prebuild gera o Prisma Client a partir do schema (tools/generate-prisma-client.mjs). lib/prisma.ts exige uma
# DATABASE_URL ao carregar as rotas; esta aponta para uma porta fechada, só existe neste RUN e não é segredo.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:1/build pnpm run build

FROM base AS runner
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder /app ./
# Só .next precisa ser gravável em runtime (cache e ISR); o resto fica do root, somente leitura para a aplicação.
RUN chown -R nextjs:nodejs .next
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
