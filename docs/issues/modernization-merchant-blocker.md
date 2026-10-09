# Merchant: limite funcional do legado e requisitos de retomada

Status: integração não concluída e indisponível. As URLs existentes foram
preservadas, mas não há publicação de produtos no Google neste lote. A
indisponibilidade não é uma implementação funcional da feature.

## Evidência da árvore

`lib/google-merchant/client.ts` instancia `google.content('v2')`. A
implementação histórica recebe configuração global.
`lib/google-merchant/sync-service.ts` consulta equipamentos globais e possui
limpeza dos produtos remotos ausentes. `lib/google-merchant/mapper.ts` usa
`pricePerDay` como preço do produto, marca GB fixa, URL global e frete gratuito
inventado. Reutilizar esse conjunto numa locadora selecionada causaria mistura
de catálogo e não descreveria corretamente uma oferta de aluguel.

Os quatro métodos administrativos em `app/api/admin/google-merchant` validam
membership ADMIN e retornam 503 com `TENANT_MERCHANT_ADAPTER_UNAVAILABLE`. O
cron `app/api/cron/sync-google-merchant` exige autorização e também está
indisponível. O código histórico permanece para referência de compatibilidade,
mas a factory `createGoogleMerchantClient()` agora lança
`GOOGLE_MERCHANT_LEGACY_DISABLED`, sem ler credenciais globais. Isso impede que
`scripts/run-sync.ts` e `scripts/resync-products.ts` reativem esse caminho ao
chamar a factory. Esses scripts não foram executados. A classe histórica não
deve ser reutilizada diretamente.

Onda 135 (decisão D9 do dono: portar, nunca apagar): o conjunto foi copiado para
`scripts/ops/google-merchant/` com o Prisma pelo `@gb-locacoes/backend/runtime`,
e `scripts/run-sync.ts` e `scripts/resync-products.ts` passaram a usá-lo. A
recusa `GOOGLE_MERCHANT_LEGACY_DISABLED` continua, inclusive antes de qualquer
consulta ao banco (`tests/unit/merchant-retirement.test.ts`). A quarentena
COD-04 foi transferida com aprovação `hygiene.baseline`; `lib/google-merchant/`
sai com a raiz legada. As rotas 503, o cron e a dependência `googleapis` ficam.

## Dependências externas verificadas

A Content API encerrou seu ciclo em 18/08/2026; a degradação de serviço começou
em 01/09/2026. O alvo técnico de uma integração nova é Merchant API, não uma
troca de credenciais na antiga API. Fonte:
[atualizações oficiais Merchant API](https://developers.google.com/merchant/api/latest-updates).

Na Merchant API, gravação usa
`products/v1/accounts/{account}/productInputs:insert` com uma data source
explícita, enquanto o produto processado é um recurso separado. Conta e data
source precisam ser vinculadas à locadora e à oferta, e uma resposta de inserção
não comprova aprovação nem exibição pública. Fonte:
[inserção oficial de produtos](https://developers.google.com/merchant/api/guides/quickstart/insert-first-product).

O Google exige registro do projeto GCP e homepage verificada. O registro requer
uma conta real e não está disponível em contas de teste. Isso é provisionamento
externo, não algo demonstrável com os mocks locais. Nenhum registro, convite,
permissão, verificação de domínio ou API remota foi executado. Fonte:
[registro de desenvolvedor](https://developers.google.com/merchant/api/guides/quickstart/registration).

A política de Shopping restringe ofertas que não resultam na aquisição de um
produto tangível. A árvore modela diárias e devolução de equipamentos, não preço
de venda. A conclusão técnica é que o mapper atual não demonstra uma oferta
elegível: não converteremos aluguel em venda fictícia para ligar a integração.
Elegibilidade da oferta e o produto Google aplicável precisam ser confirmados
antes de implementar publicação. Isso não afirma que todo produto de publicidade
Google proíbe locação. Fonte:
[conteúdo Shopping não suportado](https://support.google.com/merchants/answer/6150006?hl=en).

## Condições para retomar

1. Definir uma oferta fiel ao negócio e confirmar o produto Google que a aceita,
   sem adicionar venda de equipamentos ou um novo serviço comercial
   implicitamente.
2. Provisionar conta, domínio, projeto e data source adequados; cadastrar
   TenantIntegration e referência de credencial específicas. Não usar primeiro
   tenant, conta global ou valores vindos do payload como autoridade.
3. Implementar adapter Merchant API com host fixo, autenticação pelo SDK
   oficial, timeout, erros sanitizados e registry de produtos pertencentes ao
   vínculo. Remover apenas produtos comprovadamente gerenciados pela mesma
   integração; não limpar o catálogo inteiro.
4. Caracterizar payload, validação de confirmação e recuperação/idempotência em
   mocks. Ensaiar com conta autorizada separadamente antes de declarar
   funcionamento externo.

Enquanto essas condições não forem resolvidas, preservar o 503 explícito. Não
criar uma opção que habilite o mapper histórico silenciosamente.

## Validação

A onda 52 (2026-10-02, sem commit) monta os quatro métodos administrativos
também em apps/services/api, com o mesmo principal, ACL e 503 do legado. O
envelope indisponível tem implementação única em backend/http/merchant.ts. Isso
é paridade da quarentena HTTP; não entrega publicação Merchant. A factory
histórica, os scripts e o cron continuam bloqueados/intactos. As condições de
retomada acima permanecem pendentes. Provas de cookies reais nos dois motores e
ausência de efeitos remotos: [onda 52](../features/shared-api-host.md).

`tests/security/operations-tenancy.test.ts` mantém a cobertura de ACL e
indisponibilidade dos quatro métodos HTTP, dentro dos 58 casos da suite.
`tests/unit/merchant-retirement.test.ts` comprova que a factory antiga falha
antes de criar autenticação. Ambos passaram com exit 0, sem chamadas reais ao
Google. O trabalho continuou na extração proporcional de drivers para
`@gb-locacoes/backend/operations`, conforme
[ADR](../architecture/adr-backend-extraction.md).
