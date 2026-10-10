# Google Merchant — quarentena COD-04

O módulo foi portado da antiga `lib/google-merchant/`, retirada em F, para
preservar o código do serviço global anterior. Sua oferta/adapter por locadora
continua pendente; o porte não o ativou.

## Donos e consumidores

`client.ts`, `mapper.ts`, `sync-service.ts` e `types.ts` conservam as
responsabilidades anteriores. `scripts/run-sync.ts` e
`scripts/resync-products.ts` são consumidores operacionais do módulo; não são
provas de uma integração tenant-aware pronta. `googleapis` permanece necessário
para esse código em quarentena. Não instancie diretamente uma classe para
contornar a factory.

## Recusas e agenda

`createGoogleMerchantClient` lança `GOOGLE_MERCHANT_LEGACY_DISABLED`. As rotas
administrativas em `apps/services/api/src/app/api/admin/google-merchant` mantêm
principal da locadora/ADMIN antes de retornar 503 com
`TENANT_MERCHANT_ADAPTER_UNAVAILABLE`. O cron `sync-google-merchant` também
recusa com 503 depois da sua autorização, usando resposta própria.

O antigo `vercel.json` da raiz foi retirado em F; não acrescente a agenda global
de sync a outro host. A definição API atual só agenda late-fees, expire-quotes e
outbox. Este estado não autoriza cadastrar chaves, criar contas, acessar o
painel GB ou fazer publicação/deploy para sincronizar.

## Revisão e documentação

Use [o contrato atual](../../../docs/google-merchant-setup.md) e
[o checklist local](../../../docs/google-merchant-checklist.md) para avaliar
guards e recusas. A decisão de feed/adapter por locadora exige escopo e provas
próprios. Nenhuma política de catálogo, API pública ou implementação deste
módulo foi removida por esta atualização de documentação.

Os exemplos anteriores de credenciais, Bearer genérico, cron e monitoramento
global estão preservados sem alterações no
[arquivo histórico](../../../docs/archive/wave135-pre-f/scripts-ops-google-merchant-README.md.source).
Eles não são um quick start executável do SaaS atual.
