-- Onda 135, A4 (SEO da vitrine por locadora): a leitura pública das configurações (GET /api/settings/public) passa a
-- expor o título SEO que a locadora gravou. O padrão da coluna vinha da raiz legada com o nome da GB: uma linha criada
-- sem título daria à vitrine de outra locadora o título da GB (T12 da ADR adr-tenant-hosts; achado 143). Padrão vazio:
-- a leitura pública devolve null e a vitrine monta o título com o nome do cartão da própria locadora.
--
-- Só o padrão muda (metadado do catálogo): nenhuma linha existente é reescrita, e a da GB mantém o título que tem. O
-- onboarding e o painel já gravam o título explícito; nenhuma política, grant ou papel muda.
--
-- Falha e recuperação: o prisma migrate deploy roda este script numa transação (sem BEGIN/COMMIT aqui). Com "settings"
-- ocupada, o ALTER TABLE desiste depois do lock_timeout (55P03) em vez de enfileirar a aplicação atrás dele; tudo volta
-- atrás e nada muda, mas o deploy para com P3018 e registra a migration como falha. Com a tabela livre, rode:
--     pnpm exec prisma migrate resolve --rolled-back 202610080101_settings_seo_title_neutral_default
--     pnpm exec prisma migrate deploy
SET lock_timeout = '5s';

ALTER TABLE "settings" ALTER COLUMN "seoTitle" SET DEFAULT '';
