# Google Merchant: estado atual e limite operacional

O feed e o adapter Merchant por locadora ainda não foram aprovados para esta
plataforma. A integração global anterior permanece em quarentena COD-04 em
`scripts/ops/google-merchant`; não é um procedimento de setup ou deploy ativo.

## Contrato atual

`createGoogleMerchantClient` recusa com `GOOGLE_MERCHANT_LEGACY_DISABLED`. Os
handlers administrativos do host API resolvem o principal da locadora e exigem
ADMIN. Depois da autorização, `merchantUnavailableResponse` retorna 503,
`success: false`, `configured: false` e
`code: TENANT_MERCHANT_ADAPTER_UNAVAILABLE`.

| Método | Endpoint                                   | Resultado depois da autorização    |
| ------ | ------------------------------------------ | ---------------------------------- |
| GET    | `/api/admin/google-merchant/status`        | 503, adapter indisponível          |
| POST   | `/api/admin/google-merchant/sync`          | 503, adapter indisponível          |
| POST   | `/api/admin/google-merchant/products/[id]` | 503, adapter indisponível          |
| DELETE | `/api/admin/google-merchant/products/[id]` | 503, adapter indisponível          |
| GET    | `/api/cron/sync-google-merchant`           | 503, depois da autorização do cron |

Recusas anteriores de identidade, vínculo, papel ou cron continuam válidas. O
cron usa seu handler próprio e não promete o DTO administrativo. As fontes estão
em `apps/services/api/src/app/api/admin/google-merchant/`,
`apps/services/api/src/app/api/cron/sync-google-merchant/route.ts` e
`packages/backend/src/http/merchant.ts`.

## O que conferir localmente

Use [o checklist de quarentena](google-merchant-checklist.md) para verificar
guards, recusa do adapter e ausência de agenda ativa. Não altere status,
credenciais ou flags para fazer as rotas responderem 200. Esse estado não envia
nem remove produtos e não depende de completar uma service account da GB.

O antigo `vercel.json` da raiz foi retirado em F. `apps/clients/web/vercel.json`
não declara crons; `apps/services/api/vercel.json` declara late-fees,
expire-quotes e outbox, sem sync-google-merchant. Publicação Git não é
implantação e não autoriza conectar projetos GB, reivindicar seu domínio, criar
contas Google ou ativar scheduler. Proposta futura deve definir oferta,
credenciais e feed isolados por locadora, com aprovação e provas próprias antes
de mudar esta quarentena.

## Histórico preservado

O roteiro de contas, chaves, domínio global, sync manual e agendas do serviço
anterior foi movido sem alterar seus bytes para o
[arquivo histórico](archive/wave135-pre-f/google-merchant-setup.md.source). Ele
não deve ser executado no produto atual. O
[README da quarentena](../scripts/ops/google-merchant/README.md) descreve seus
donos e limites; nenhum código de política ou API pública foi removido.
