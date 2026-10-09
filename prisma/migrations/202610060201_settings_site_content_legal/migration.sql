-- Onda 134 (lote vitrine-conteúdo): conteúdo institucional e textos legais por locadora (decisões do dono de
-- 2026-10-06, ADR adr-saas-subscription B.18, itens 2 e 3; U5 da ADR adr-tenant-hosts).
-- Só acréscimo: colunas com padrão constante (metadado) e CHECK de forma e tamanho. Nenhuma tabela, política, grant
-- ou papel novo: as colunas herdam a RLS FORCE e os grants de "settings". Nenhum dado existente é reescrito.
-- Tamanho por octet_length(::text), determinístico (pg_column_size mede depois da compressão).
--
-- Falha e recuperação: o prisma migrate deploy roda este script numa transação (sem BEGIN/COMMIT aqui). Com "settings"
-- ocupada, o ALTER TABLE desiste depois do lock_timeout (55P03) em vez de enfileirar a aplicação atrás dele; tudo volta
-- atrás e nada muda, mas o deploy para com P3018, registra a migration como falha e todo deploy seguinte é recusado
-- (P3009) até ela ser marcada como desfeita. Com a tabela livre, rode:
--     pnpm exec prisma migrate resolve --rolled-back 202610060201_settings_site_content_legal
--     pnpm exec prisma migrate deploy
SET lock_timeout = '5s';

ALTER TABLE "settings"
  ADD COLUMN "siteContent" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "termsDocument" JSONB,
  ADD COLUMN "termsPublishedAt" TIMESTAMP(3),
  ADD COLUMN "privacyDocument" JSONB,
  ADD COLUMN "privacyPublishedAt" TIMESTAMP(3),
  ADD COLUMN "returnPolicyDocument" JSONB,
  ADD COLUMN "returnPolicyPublishedAt" TIMESTAMP(3);

ALTER TABLE "settings"
  ADD CONSTRAINT "settings_site_content_object" CHECK (jsonb_typeof("siteContent") = 'object'),
  ADD CONSTRAINT "settings_site_content_size" CHECK (octet_length("siteContent"::text) <= 65536),
  ADD CONSTRAINT "settings_terms_document_object" CHECK ("termsDocument" IS NULL OR jsonb_typeof("termsDocument") = 'object'),
  ADD CONSTRAINT "settings_terms_document_published" CHECK (("termsDocument" IS NULL) = ("termsPublishedAt" IS NULL)),
  ADD CONSTRAINT "settings_terms_document_size" CHECK ("termsDocument" IS NULL OR octet_length("termsDocument"::text) <= 262144),
  ADD CONSTRAINT "settings_privacy_document_object" CHECK ("privacyDocument" IS NULL OR jsonb_typeof("privacyDocument") = 'object'),
  ADD CONSTRAINT "settings_privacy_document_published" CHECK (("privacyDocument" IS NULL) = ("privacyPublishedAt" IS NULL)),
  ADD CONSTRAINT "settings_privacy_document_size" CHECK ("privacyDocument" IS NULL OR octet_length("privacyDocument"::text) <= 262144),
  ADD CONSTRAINT "settings_return_policy_document_object" CHECK ("returnPolicyDocument" IS NULL OR jsonb_typeof("returnPolicyDocument") = 'object'),
  ADD CONSTRAINT "settings_return_policy_document_published" CHECK (("returnPolicyDocument" IS NULL) = ("returnPolicyPublishedAt" IS NULL)),
  ADD CONSTRAINT "settings_return_policy_document_size" CHECK ("returnPolicyDocument" IS NULL OR octet_length("returnPolicyDocument"::text) <= 262144);
