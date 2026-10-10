# Checklist local da quarentena Google Merchant

Este checklist verifica o estado intencionalmente indisponível. Não aprova feed
por locadora, cadastro externo ou implantação. Marque um item somente com
evidência da fonte ou da execução correspondente; uma leitura de código não
equivale a teste do handler.

## Código e entrada

- [ ] `scripts/ops/google-merchant/client.ts` mantém a recusa
      `GOOGLE_MERCHANT_LEGACY_DISABLED` de `createGoogleMerchantClient`.
- [ ] Os handlers administrativos do host API mantêm resolução do principal da
      locadora, recusa correspondente e exigência ADMIN antes do adapter.
- [ ] Depois da autorização, status/sync/products retornam a recusa 503 com
      `TENANT_MERCHANT_ADAPTER_UNAVAILABLE`, sem envio ou remoção de produtos.
- [ ] `/api/cron/sync-google-merchant` mantém autorização de cron e sua recusa
      503 própria. Sua resposta não precisa reproduzir o DTO administrativo.
- [ ] Testes preservam os casos de recusa e não contornam guards ou factory com
      uma credencial global para obter sucesso artificial.

## Agenda e operação

- [ ] `apps/clients/web/vercel.json` permanece sem crons.
- [ ] `apps/services/api/vercel.json` contém somente late-fees, expire-quotes e
      outbox, sem sync-google-merchant.
- [ ] O antigo `vercel.json` da raiz, retirado em F, não foi recriado.
- [ ] Nenhum projeto GB, domínio, credencial histórica, conta Google ou
      scheduler externo foi usado para certificar este estado local.

503 depois de autorização é o contrato de quarentena, não uma chave ausente que
deva ser reparada. 401/403 ou outra recusa de guard exige análise do caso real;
não substitua sua expectativa por 503 para ocultar uma fronteira quebrada.

## Próxima oferta e histórico

Uma integração futura exige decisão sobre o feed por locadora, ownership de
credenciais/contas, catálogo e agenda; precisa autorização e validação próprias.
Build, push ou checklist não declara produtos aprovados no Merchant Center.
Consulte [o contrato atual](google-merchant-setup.md) e
[o README da quarentena](../scripts/ops/google-merchant/README.md).

O checklist global anterior, inclusive campanha/cron/deploy, está preservado
byte-exato no
[arquivo histórico](archive/wave135-pre-f/google-merchant-checklist.md.source).
Nenhuma dessas etapas antigas é uma instrução ativa desta plataforma.
