-- Migração B (ADR docs/architecture/adr-tenant-hosts.md, Lote 7a). Aditiva: nenhum dado existente muda.
--
-- 1. Diretório público com opt-in: "directoryListed" nasce false para todas as locadoras, inclusive as
--    existentes; só entra na busca quem escolher. O índice atende o filtro da busca
--    (listadas e ACTIVE) antes do ILIKE no nome.
-- 2. "platform_rate_limits": janelas fixas compartilhadas entre instâncias. Tabela global (sem
--    "tenantId", sem RLS; classificada em tools/tenant-models.json#globalModels). A chave é
--    "<rota>:<hmac(identificador)>:<índice da janela>", nunca IP ou e-mail em claro. O consumo é um
--    upsert atômico (INSERT ... ON CONFLICT DO UPDATE) e a limpeza das janelas vencidas roda no cron
--    de outbox pelo índice de "expiresAt".

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "directoryListed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "organizations_directoryListed_status_idx" ON "organizations"("directoryListed", "status");

-- CreateTable
CREATE TABLE "platform_rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "platform_rate_limits_expiresAt_idx" ON "platform_rate_limits"("expiresAt");
