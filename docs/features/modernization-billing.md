# Cobranças duráveis por locadora

Status: implementação incremental; integrações reais, interface completa e
publicação não certificadas.

Onda 123 (2026-10-05, sem commit): a configuração de conta própria passa a
executar reconciliação financeira limitada quando detecta interrupção. O
incidente fica na auditoria de plataforma; pagamentos e cursor ficam na
auditoria da locadora, sob RLS e papel de negócio. Processamento de pagamento e
outbox existentes são reutilizados. Fotografia concluída não autoriza retomar
entrega: revisão, atualização final e prova operacional continuam pendentes. Ver
[conta de recebimentos](conta-recebimentos.md) e onda 123 de
[API compartilhada](shared-api-host.md).

## Propósito e escopo

Separar a obrigação financeira de suas tentativas no provedor, mantendo
ownership, valor persistido, histórico e recuperação após falhas. PIX e boleto
usam a integração Asaas explicitamente configurada da locadora. O legado ainda
tem consumidores em migração; não existe autorização para emitir cobranças reais
nesta entrega.

## Entradas e contrato HTTP

- POST /api/payments/pix e /api/payments/boleto/generate: tenant e
  proprietário/permissão financeira obrigatórios; 202 significa emissão
  pendente, 200 significa resultado disponível.
- POST /api/admin/quotes/[id]/generate-boleto: obrigação e evento persistidos
  juntos. Não fabrica linha digitável, QR ou PDF.
- PUT /api/payments/boleto/[id]/regenerate: 202 com operationId; a obrigação não
  é apagada.
- POST /api/admin/quotes/[id]/send-boleto: exige tentativa emitida e enfileira o
  envio dessa tentativa. Enquanto a emissão estiver pendente, responde 409.
- GET /api/cron/outbox: CRON_SECRET obrigatório. A configuração de cron foi
  adicionada localmente; não foi publicada.

## Fluxo

Payment conserva a obrigação. PaymentAttempt guarda referência externa, valor,
vencimento e resposta de cada emissão. A outbox é escrita na mesma transação do
pedido. O worker persiste PROCESSING antes do POST externo e usa uma referência
estável da tentativa para reconciliação.

Um timeout de emissão deixa UNKNOWN. A próxima entrega consulta o provedor; não
repete o POST enquanto o resultado for desconhecido. Uma confirmação de
pagamento recebida durante a reconciliação produz outro evento durável, com
externalId, antes da conversão idempotente do orçamento.

### Estados da tentativa e religação (ondas 6 a 9)

- **Falha provada sem efeito** (`maybeApplied = false`, por exemplo 429, 401 ou
  o interruptor antes de qualquer escrita): `provenNotApplied` devolve a
  tentativa a `QUEUED` (o cancelamento a `REQUESTED`) e relança para a outbox
  tentar de novo. Resposta inutilizável depois de uma escrita aceita
  (`POST /customers`, `POST /payments`, `DELETE /payments/{id}`) sai com
  `maybeApplied = true`, e o `maybeApplied` do `create` fala da cobrança: falha
  incerta antes do `POST /payments` também volta à fila, e o cliente já
  cadastrado é achado pela busca por CPF/CNPJ. O resto fica `UNKNOWN`.
- **Recusa definitiva do pedido**: só o domínio decide, lançando
  `ChargeRequestRejected` (subclasse de `BillingProviderError`) na validação
  local (valor, `assertChargeRequest`) ou no 400 da criação (cadastro do cliente
  ou `POST /payments`), sempre depois de `reject`. A tentativa vai a `FAILED`
  com `response.rejection = {reason, status, providerCodes}` (só os
  `errors[].code` do Asaas, nunca a descrição), e o evento termina na primeira
  entrega com `PAYMENT_REQUEST_REJECTED`. Um 400 numa leitura depois do POST
  aceito (`pixQrCode`, `identificationField`, a busca pela referência) é falha
  passageira. 401, 403, 404, 429, 5xx, o interruptor e `AMBIGUOUS` também são
  passageiros.
- **Religação pelo cron da outbox** (`scheduleIssuanceReconciliation`, chamada a
  cada passada de `GET /api/cron/outbox`, que devolve
  `issuanceReconciliations`):
  - `UNKNOWN` ou `PROCESSING` parada há mais de 15 min
    (`UNKNOWN_ISSUANCE_SETTLE_MS`, `isSettledUnknown`): conciliação pela
    referência da tentativa, chave
    `payment.issue:reconcile:<tentativa>:<updatedAt>` (e `:<n>` nas rodadas
    seguintes); cobrança achada, vincula sem outro POST; nada, volta a `QUEUED`
    e emite; cobrança divergente encerra com `PAYMENT_RECONCILIATION_REQUIRED`
    (revisão manual, nunca reagendada);
  - `QUEUED` sem evento de emissão vivo: `payment.issue:resume:<tentativa>[:n]`;
  - cobrança aberta (`PENDING` ou `OVERDUE`, PIX ou BOLETO, sem `transactionId`
    e sem tentativa) cujo último evento de emissão morreu por `DELIVERY_FAILED`:
    `payment.issue:open:<paymentId>`. Cobrança sem pedido de emissão não é
    tocada (o PIX da taxa de extensão em `rentals/lifecycle.ts` nunca enfileira
    emissão).
- **Espera entre rodadas** (`nextRound`): a última rodada decide; com uma viva,
  nenhuma nova; esgotada por `DELIVERY_FAILED`, a seguinte depois de 15 min, 30
  min, 1 h… até 6 h; encerrada com código, nenhuma, salvo se a tentativa mudou
  depois.
- **Sem cobrança duplicada**: toda emissão busca pela referência da tentativa
  antes de reservar, a reserva é atômica, e `PROCESSING`/`UNKNOWN` só voltam à
  fila depois de uma busca vazia além da janela. Premissa escrita no código: no
  máximo 3 chamadas ao Asaas depois da reserva, cada uma com teto de 2 min, e a
  função do cron vive no máximo 5 min.
- **Datas**: `paidAt` só de data (`paymentDate`/`clientPaymentDate`) é a data
  civil de São Paulo (`T03:00Z`, `parseAsaasDate`).
- **Lacuna de produto**: tentativa `FAILED` não tem fluxo de reemissão pelo
  lojista; `requestBoletoReissue` exige `transactionId`, e o pedido de pagamento
  reaproveita a tentativa `:initial`. Falta um fluxo que mostre a recusa com os
  códigos, deixe corrigir vencimento e dados do cliente e crie uma tentativa com
  referência nova, conciliando antes pela anterior.

Entradas 207 e 208 de `docs/issues/known-issues.md`; decisões abertas (janela de
15 min, todo 400 da criação encerra, `AMBIGUOUS` passageiro) em
`docs/architecture/modernization.md`, seção "Ondas 6 a 9".

Na reemissão, cancellationStatus segue NONE → REQUESTED → PROCESSING →
CONFIRMED, ou UNKNOWN em resultado incerto. Só uma confirmação explícita permite
criar a tentativa seguinte. HTTP 404 não comprova cancelamento. A API oficial
diferencia exclusão de cobrança e estorno:
[Asaas — excluir cobrança](https://docs.asaas.com/reference/excluir-cobranca).

Cobrança anterior anulada só no sistema (critério da onda 4, ligado e ampliado
na onda 5): uma linha PIX ou BOLETO `CANCELLED` com `transactionId` só libera
cobrança nova com prova de fim, isto é, tentativa desse id em `CANCELLED` ou com
cancelamento `CONFIRMED`. O critério mora em
`packages/backend/src/modules/billing/cancelled-charges.ts`
(`withCancelledChargeProof`: preparar, ler o provedor fora de SQL, conciliar sob
o lock de quem chamou e preparar de novo) e vale para o boleto do orçamento
(`ensureQuoteBoletoPayment`, `lib/quote-boleto.ts`) e para o pedido de PIX ou
boleto (`requestPayment`, `lib/payment-request.ts`):

- aberta no Asaas com o mesmo valor e meio: a linha volta a ser a cobrança
  vigente;
- paga: volta a ser a vigente e `payment.provider.confirmed` vai para a outbox;
- removida e não paga: a prova é gravada e sai uma única cobrança nova;
- `REFUNDED`, outro valor ou meio, 404, mais de uma aberta ou outra cobrança
  vigente de qualquer meio (inclusive `PAID` parcial): 409, nada muda.

A leitura vem de `readTenantProviderCharge` (`lib/payment-obligation.ts`): a
única integração `ASAAS` `ACTIVE` da locadora, com a credencial dela, e o `get`
do `createAsaasGateway`. Integração ausente, ambígua ou sem chave é
indisponibilidade (503), nunca prova de cancelamento; chave recusada pelo
provedor (401/403) ou resposta fora do contrato é 502; divergência é 409.
Nenhuma dessas respostas emite segunda cobrança, e as mensagens ("Cobrança
anterior…") são as mesmas para PIX e boleto (entradas 187 e 199 de
`docs/issues/known-issues.md`). O valor cobrado é sempre o saldo em centavos de
`obligationBalance` (entrada 186).

Valores antigos gravados com fração de centavo e cobranças anuladas sem prova
são conciliados à mão: relatório somente leitura
`scripts/ops/legacy-cents-report.ts` e runbook
[conciliação de cobranças legadas](../guides/legacy-cents-reconciliation.md).

## Invariantes e concorrência

- O servidor deriva valor e titular da obrigação e do ClientProfile da locadora.
- Uma cobrança pendente em outro método impede uma segunda cobrança integral.
- Confirmações incluem a referência externa vigente; eventos de tentativas
  antigas exigem reconciliação.
- Workers atrasados não podem vincular novamente uma tentativa cancelada:
  estado, tentativa mais recente e atualização condicional são validados dentro
  do lock.
- Rede externa fica fora da transação SQL. Locks de locação e de emissão têm
  ordem consistente.
- Reemissão preserva respostas e metadados anteriores em PaymentAttempt; eventos
  de exclusão não cancelam a obrigação.
- Email usa identidade visual da locadora, destinatário persistido e chave
  idempotente. Eventos antigos não enviam links de tentativas substituídas.
- Pagamento não representa retirada física. A conversão continua sujeita à
  disponibilidade e seu erro não apaga o pagamento confirmado.
- Edição do orçamento nunca muda o valor de uma cobrança já emitida ou vencida:
  a cobrança base (`RENTAL`/`DEPOSIT`) é travada com `:issue:<paymentId>` e só a
  `PENDING` nunca emitida é reprecificada; o resto responde 409
  `PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION` (`docs/features/quote-system.md`,
  seção 7.6).

## Arquivos

Backend em packages/backend/src/modules/billing e outbox; adaptação Prisma/HTTP
composta em lib/payment-*.ts, lib/quote-boleto.ts e nos hosts
legado/compartilhado. Obrigação, pedido, confirmação, emissão e reemissão têm
implementação única em packages/backend; lib conserva a composição com as
dependências reais. A extração de todos os consumidores, verificadores e jobs
ainda está pendente.

## Erros e limites

Falhas persistem códigos, nunca respostas com credenciais. Divergência de valor,
identidade ou estado exige conciliação. Pagamentos parciais históricos e
cobranças antigas sem mapeamento não são reescritos automaticamente.
Cancelamento definitivo da obrigação, reconciliação assistida e UI de tentativas
ainda precisam do fluxo completo.

## Validação

- tests/unit/payment-creation.test.ts: ownership, valor, titular, configuração e
  conflito entre métodos.
- tests/unit/payment-issuance.test.ts e payment-cancellation.test.ts: timeout,
  replay, identidade externa e concorrência.
- tests/unit/billing-database.test.ts: PostgreSQL real com HTTP simulado,
  deduplicação, rede fora de SQL, preservação do histórico e retorno tardio após
  reemissão.
- tests/critical/quote-boleto.test.ts: obrigação idempotente, tenant
  estrangeiro, valor alterado e pagamento preservado.
- tests/contract/asaas-fake.test.ts (73 testes no lote S4, 103 na onda 8):
  cliente HTTP, redação, dinheiro, CNPJ alfanumérico, subconta, eventos,
  `maybeApplied` por escrita e leitura, recusa definitiva e `PROCESSING`
  abandonada contra o dublê. Roda com `pnpm test:contract`
  (`vitest.contract.config.ts`), que tem passo no CI desde a onda 4.
- tests/unit/payment-issuance-database.test.ts (ondas 6 a 9): emissão real em
  PostgreSQL descartável contra o dublê: volta à fila, conciliação de `UNKNOWN`
  em rodadas, `PROCESSING` abandonada, `QUEUED` sem evento, pedido recusado que
  nunca é religado, 400 em leitura e cobrança aberta sem tentativa.
  tests/unit/outbox-cron-database.test.ts chama o `GET` real de
  `/api/cron/outbox`.
- tests/unit/quote-obligation-edits.test.ts (onda 6): edições do orçamento
  contra as cobranças base, inclusive a concorrência da trava `:issue:`.
- tests/unit/quote-settlement-database.test.ts: saldo em centavos na quitação e
  na conversão, e reemissão de boleto `CANCELLED` só com prova de fim no
  provedor, contra o dublê `tests/helpers/fake-asaas` (onda 4). O caso "sem
  leitor → 409" monta a composição sem leitor de propósito.
- tests/unit/cancelled-charge-proof-database.test.ts (17 testes, onda 5): a
  composição real, com a credencial vinda do ambiente e o `fetch` global
  apontado para o dublê, no boleto e no pedido de PIX/boleto; confere que o lock
  de mutação da locadora fica livre durante a leitura no provedor.
- tests/unit/legacy-cents-report.test.ts (8 testes, onda 5): relatório de
  centavos por locadora, `READ ONLY` (uma escrita dentro da transação é recusada
  com `25006`), `ROLLBACK` no fim e `roundToCents` (`ROUND_HALF_UP`).
- Pendente: `pnpm test:integration` completo, com o `next dev`
  (`quote-flow.test.ts`).

Testes não chamam contas reais de provedor. Sandbox homologado, builds, operação
e evidência visual continuam necessários.

## Adapter do Asaas (lote S4, onda 3, commit `be859915`)

Base do ADR `docs/architecture/adr-saas-subscription.md` (D13, D21, D24, B.6 e
B.7.3 a B.7.6). Nenhuma chamada real ao Asaas foi feita.

- **Cliente HTTP único** (`billing/asaas-http.ts`): gateway, `readAsaasPayment`
  e o parser de subconta só usam ele.
  - A origem vem do ambiente (`sandbox` ou `production`) e a URL final é
    conferida contra ela; `redirect: 'error'`; timeout de 12 s por padrão, até
    120 s.
  - Os ids entram por `asaasPath`, que recusa `..`, `%2e%2e`, query embutida e
    `//host`.
  - Interruptor `PLATFORM_ASAAS_OUTBOUND_DISABLED`, lido a cada chamada: só
    vazio, `false`, `0`, `off` e `no` mantêm a saída ligada; qualquer outro
    valor corta, e a tentativa fica `QUEUED`.
  - Saída por IP fixo: com `PLATFORM_ASAAS_EGRESS_PROXY_URL` definida, a chamada
    só sai pelo transporte registrado em `registerAsaasEgressTransport` (ou o
    `egress` do cliente). Sem transporte ou com URL inválida, falha fechada
    (`EGRESS_UNAVAILABLE`), nunca direto. Hoje nenhum transporte é registrado: o
    proxy real precisa de `undici` (decisão pendente).
  - Credencial em string ou portador `{ use }` (`AsaasSecretValue`, que nunca
    aparece em JSON, `String`, template ou inspect). Chave vazia, com espaço ou
    caractere de controle é recusada antes da rede.
  - Nenhum erro ou log leva corpo, headers, query (CPF/CNPJ) ou `description` do
    Asaas; o logger injetável recebe só método, caminho sem query, status,
    desfecho e duração. `redactAsaasSecrets` e `ASAAS_SECRET_FIELDS` ficam
    exportados.
  - `BillingProviderError` tem `code`, `reason`, `status`, `providerCodes` (só
    `errors[].code`), `retryAfterSeconds` e `maybeApplied`; a mensagem é só o
    código. 400, 401, 403 e 404 viram `REJECTED`; 429 virou
    `UNAVAILABLE`/`RATE_LIMITED` (antes `REJECTED`); 5xx vira `UNAVAILABLE` e,
    em escrita, `maybeApplied = true`.
  - Corpo com `Decimal`, número não finito ou `BigInt` é recusado antes da rede.
- **Dinheiro** (`billing/asaas-amount.ts`): `toMoney`, `toAsaasAmount`,
  `fromAsaasAmount` e `sameAmount` em `Prisma.Decimal`; `issue-payment` e
  `cancel-attempt` não comparam mais com `!==` (entrada 174 de
  `docs/issues/known-issues.md`). `issuePayment` valida valor, vencimento e
  CPF/CNPJ antes da reserva.
- **CPF/CNPJ**: `normalizeAsaasDocument` tira só a máscara e mantém as letras do
  CNPJ alfanumérico em maiúsculas (entrada 173).
- **Subconta**: `parseAsaasAccountCreation` aceita a chave em `apiKey` ou em
  `accessToken.apiKey`; chaves diferentes, id ausente ou chave malformada dão
  `INVALID_RESPONSE`; sem chave, `credential` é `null` (o S9 pode ir para
  `KEY_RECOVERY_REQUIRED`).
- **Eventos** (`billing/asaas-events.ts`): `parseAsaasEvent` devolve união
  discriminada por categoria (`PAYMENT_*`, `SUBSCRIPTION_*`, `ACCOUNT_STATUS_*`,
  `ACCESS_TOKEN_*`), sem lançar, com valores em `Decimal` e datas em Brasília;
  em `ACCESS_TOKEN_*` a chave é descartada. `mapAsaasStatus` e
  `parseAsaasWebhook` foram mantidos.
- **Dublê de contrato** (`tests/helpers/fake-asaas/**`): `fetch` em memória com
  conta raiz e subcontas, clientes, cobranças PIX e boleto, assinaturas,
  webhooks assinados, CNPJ alfanumérico e falhas injetáveis (400 a 5xx, timeout,
  rede, "aplica e perde a resposta" e, desde a onda 6, `body`: 200 estragado,
  com ou sem aplicar a escrita). As respostas vêm de fixtures sanitizadas. Desde
  a onda 6 o dublê recusa `DELETE /subscriptions` por padrão (405, registrado em
  `forbiddenRequests`; `allowSubscriptionDelete: true` reproduz o Asaas), como
  política da plataforma; o cliente HTTP de produção ainda não tem essa guarda.
  `contract-suite.ts` é reutilizável contra o sandbox (S15).
- Suposições não confirmadas levam o comentário `VERIFICAR-SANDBOX`
  (`rg -n VERIFICAR-SANDBOX packages/backend tests`); são o checklist do T-X1 no
  S15.

## Retirada da emissão simulada

O gateway legado `lib/payment-gateways/boleto.ts` e seu gerador de PDF não
possuíam consumidores produtivos após a migração. Foram retirados junto dos
mocks obsoletos e da opção `BOLETO_GATEWAY_TYPE=direct`. A emissão passa
exclusivamente pela obrigação persistida, tentativa e adapter tenant de
`packages/backend`; nenhum fallback fabrica uma cobrança. O parser/verificador
Asaas ainda consumido pelo webhook e cron permanece até sua extração
incremental.

## Confirmação e reemissão compartilhadas (onda 39, 2026-10-02)

payment-errors, payment-processor e boleto-reissue em backend/billing guardam as
implementações únicas antes presentes em lib. createPaymentProcessor recebe a
transação de locação; createBoletoReissueRequest recebe a mesma transação;
createBoletoReissueWorker recebe transação, credencial por locadora e
processPayment. lib/payment-processor e lib/payment-reissue apenas compõem essas
factories para seus consumidores existentes. PaymentRequestError conserva uma
única identidade, inclusive na fachada de payment-obligation.

O host compartilhado instala as mutações de settings, status, vencimento e
preservação do histórico. O pedido de reemissão é durável/idempotente (202), sem
acesso ao provedor pelo handler; execução e crons continuam legados. Paridade
estrutural dos corpos, banco real, falhas SQL, concorrência entre hosts e
contrato fake registrados na onda 39 de [API compartilhada](shared-api-host.md).
Emissão/cancelamento externos, reconciliação e operação de jobs ainda não
migraram.

## Pedidos e emissão compartilhados (onda 40, 2026-10-02)

createPaymentRequests, createTenantProviderChargeReader, createPaymentIssuance e
createPaymentDocuments em backend/billing compõem a implementação antes presente
em lib. Credenciais env de locadora usam createIntegrationCredentialResolver de
backend/runtime, com leitura por chamada e mesma validação. O schema de pedido
existente pertence a contracts/payments.

O serviço monta PIX, geração/regeneração de boleto, geração administrativa e
consulta do documento do provedor. Legado usa as mesmas factories. Locks,
centavos, titular, ownership, prova do cancelamento, tentativas e gravação
atômica da outbox preservados. PDF mantém 409 ou redirect https privado para o
Asaas, sem baixar o documento no servidor.

issueTenantPayment e scheduleIssuanceReconciliation continuam executados pelo
legado; nenhum job foi adicionado ao serviço. Paridade HTTP nos dois motores,
rollback SQL, concorrência, contrato fake e resultados consolidados na onda 40
de [API compartilhada](shared-api-host.md). Saída externa foi desabilitada nas
provas HTTP; não há certificação de operação no Asaas real ou cutover.

## Verificação e eventos no host compartilhado (onda 41)

POST boleto/verify e recepção PIX/Asaas, com e sem integrationId, agora existem
nos dois hosts. URLs sem integração conservam 410. Auth/HMAC/token, lookup de
recurso e tenant em backend/identity; inbox e lease em backend/outbox;
consumidores e verificação em backend/billing; schemas existentes em
contracts/payments. lib e apps/services/api fazem a composição real.

A inbox e seu evento durável precedem efeitos. Dedupe e identidade conflitante,
lease entre hosts, retry, terminal 400/403, confronto de valor, refund,
cancelamento e tentativa antiga pagos mantêm o comportamento anterior. Verify
exige FINANCIAL/WRITE e conserva consulta explícita, budget, DTO e erros. Worker
fica compartilhado, mas seu único scheduler continua legado. Paridade HTTP,
SQL/RLS, testes, limites e dívida de organização suspensa na onda 41 de
[API compartilhada](shared-api-host.md). Nenhum webhook foi reconfigurado no
provedor e nenhuma chave real foi usada.

## Consumidores de boleto (onda 66, 2026-10-03)

Financeiro/orçamentos usam createAdminPaymentApi com HttpClient configurado.
Geração POST/segunda via PUT sem corpo, vencimento PATCH com dueDate.
JSON/status explícitos conservam 202 pendente inclusive sem processing e
mensagens anteriores. Cliques duplicados/escopo protegidos; após refresh
assíncrono, ciclo conferido antes de sucesso. Payment e payment.issue persistem;
PaymentAttempt só é criado pelo worker. Backend/valores/locks/agenda intactos.
Outros consumidores/Asaas real pendentes. Provas e limites na onda 66 de
[API compartilhada](shared-api-host.md).
