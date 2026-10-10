# Limites do plano

> **Status**: Critical **Last updated**: 2026-10-04

---

## 1. Purpose

Cada plano define cotas (equipamentos e usuários da equipe) e módulos (pagamento
online, domínio próprio, logística, manutenção, assinatura de contrato,
WhatsApp, caixa de e-mail e feed de produtos). Esta página descreve o contrato
desses direitos, do dinheiro em trânsito e dos erros de acesso, definidos pelo
ADR `docs/architecture/adr-saas-subscription.md` (B.3, B.10, B.11, D18 e D21).

O lote S0 entrega o contrato em `@gb-locacoes/contracts/entitlements`. O lote S1
acrescentou as funções puras em `packages/domain/src/assinatura/direitos.ts`
(onda 3, commit `be859915`): `avaliarCota(limite, usado, acrescimo)`,
`recursoNoPlano`, `permiteEscrita(acesso, excecao)` e
`direitosEfetivos(base, ajustes, agora)`, que aplica só ajustes vigentes (o mais
recente por chave) e ignora e lista chave fora do plano ou valor de tipo errado.
O primeiro corte do S8 (onda 96, sem commit) aplica admissão e cota de modelos
no cadastro de equipamentos, dentro da transação usada pelos dois hosts. A onda
97 acrescenta admissão HTTP comum, acesso projetado, dono atual e módulos. O S8
completo ainda não foi entregue nem ativado.

## 2. Scope

**In scope**

- `EntitlementsV1`: formato versionado (`schema: 1`) guardado em
  `PlanVersion.entitlements`, com todas as cotas e todos os módulos
  obrigatórios. Cota `null` é ilimitada; zero, negativo e fração são recusados.
- `EntitlementOverride`: exceção por locadora com chave `limits.<cota>` (valor
  cota) ou `features.<módulo>` (valor booleano).
- `Money` e `SignedMoney`: string decimal com duas casas, até 10 dígitos
  inteiros (cabe em `Decimal(12, 2)`).
- Códigos de erro de acesso e o status HTTP de cada um.
- Admissão transacional de `createEquipment`: projeção de acesso, plano vigente,
  exceções válidas, contagem por locadora e lock da cota.
- Admissão HTTP compartilhada após vínculo/CSRF: acesso e dono atuais, módulos
  nas escritas e exceções estritas para operações existentes.
- Admissão na transação dos comandos de logística, manutenção, cobrança,
  orçamento, locação e perfil descritos nas ondas 98–100.

**Out of scope**

- Cota de equipe, demais escritas/módulos ainda não cobertos e matriz HTTP
  completa do S8. Cron de divulgação e site por estado entraram na onda 130
  (seção "Jobs de tenant" abaixo e `docs/features/site-por-estado.md`).
- Esconder, desabilitar e explicar na interface (widget `limite-plano`, S11b).

## 3. Entry Points

- Contrato: `packages/contracts/src/entitlements.ts`, exportado como
  `@gb-locacoes/contracts/entitlements`.
- Guarda instalado:
  `packages/backend/src/modules/entitlements/equipment-admission.ts`, chamado
  por `catalog/equipments.ts`; domínio em `assinatura/direitos.ts`.
- Consumidores restantes: política compartilhada de principal/permissões, demais
  escritas e interface `shared/api`.

## 4. Core Flow

1. A versão do plano grava `EntitlementsV1` validado.
2. Os direitos efetivos da locadora são os da versão vigente mais as exceções
   vigentes (`EntitlementOverride`).
3. Criar além da cota responde 402 `PLAN_LIMIT_REACHED` com `resource`, `limit`
   e `used`. Depois de um downgrade, `used` pode passar de `limit`: nada é
   apagado nem escondido; só a criação fica bloqueada.
4. Mutação de módulo fora do plano responde 402 `MODULE_NOT_IN_PLAN` com
   `feature`; essa fiscalização nos demais módulos ainda está pendente.

### Primeiro corte do S8: cadastro de equipamentos

`PLATFORM_SUBSCRIPTION_ENFORCEMENT` permanece `off` nos exemplos. Ausente ou
`off`, não há novas leituras de plano/contagem ou locks de admissão. `shadow`
calcula e registra somente id da locadora/código; um savepoint permite recuperar
falha SQL da observação sem abortar o cadastro. `on`, usado nas provas locais,
aplica as recusas. Modo inválido ou plano atual ausente/inválido responde 503
genérico, sem expor dados persistidos.

No cadastro, FULL e SETUP respeitam a mesma cota; RESTRICTED recusa com 402 e
ARCHIVED com 403. A contagem é de modelos, não unidades. O guarda trava a
organização e a cota na conexão da escrita, consulta somente assinatura não
cancelada e ignora exceções revogadas, expiradas, futuras ou malformadas. A
projeção/troca de plano deve conservar a ordem organização → assinatura, assim
como os escritores comerciais existentes. Escritores futuros de exceção também
devem travar a organização antes da mudança.

Os adaptadores HTTP conservam `resource`, `limit` e `used`; nenhum endpoint novo
ou regra duplicada nos hosts. Leituras e edição existentes não aplicam a cota;
depois de downgrade os registros continuam disponíveis. Isso **não certifica** a
política geral de leitura/ownership em ARCHIVED, os módulos, a equipe,
obrigações financeiras, jobs promocionais ou o site S13. Não ativar `on` em
produção antes de completar e aceitar a matriz S8 e o preflight.

### Segundo corte do S8: admissão HTTP comum (onda 97)

`identity.createTenantPrincipalResolver` aplica a política privada de
`entitlements/request-access.ts` depois de validar mesma origem, sessão e
vínculo. Off preserva o principal original e não faz consultas comerciais.
Shadow lê em uma transação própria, registra só tenant/código e não bloqueia;
erro SQL ou do logger também não bloqueia. On acrescenta access/isOwner/actor,
derivados da organização atual, sem substituir permissões nem ownership dos
serviços.

FULL admite as escritas conforme módulos/plano atual e exceções válidas. SETUP
admite o catálogo/configurações existentes e perfil próprio. RESTRICTED mantém
leitura e admite somente devolução, encerramento de locação, conclusão de
entrega, baixa financeira, reemissão/verificação de boleto e perfil próprio, com
método e corpo estritos onde necessários. OAuth GET de Zoho que grava
credenciais é uma escrita. ARCHIVED recusa com TENANT_ARCHIVED; somente o dono
atual pode usar a exportação existente, sem conceder esse poder a outro ADMIN.

Cobrança em RESTRICTED exige locação ativa com checkOutAt anterior a suspendedAt
e sem checkInAt. A admissão não concede autoridade financeira: o serviço de
billing continua verificando dono ou FINANCIAL/WRITE. Essa decisão ainda precisa
ser revalidada na transação da cobrança; a checagem HTTP isolada não elimina
corrida com mudança de acesso/plano. Não ativar fiscalização em produção por
causa deste corte.

Os 20 adapters legados de helpers e seus pares no serviço agora encaminham a
requisição real, incluindo método, URL e corpo. Recusas comerciais preservam
envelope, Cache-Control private/no-store e Vary Cookie/Host. Não há nova rota,
flag ligada, regra de negócio nos hosts ou mudança nos jobs já aceitos.

## 5. Components and Files

- `packages/contracts/src/entitlements.ts`
- `packages/contracts/src/entitlements.test.ts`
- `packages/backend/src/modules/entitlements/equipment-admission.ts`
- `packages/backend/src/modules/catalog/equipments.ts`
- `tests/unit/equipment-admission.test.ts`
- `tests/unit/equipment-admission-http.test.ts`
- `tests/identity/equipment-quota-database.test.ts`

## 6. Data and State

- `equipments` conta modelos de `Equipment`, não unidades.
- `staffSeats` conta `Membership` ACTIVE com papel diferente de CLIENT,
  incluindo o dono.
- Tabelas existentes (S2): `plan_versions.entitlements` (JSON) e
  `entitlement_overrides`.

## 7. Constraints and Edge Cases

- Objetos estritos em todos os níveis: chave a mais é recusada.
- `Money` recusa `number`, uma casa decimal, zero à esquerda, sinal, expoente,
  vírgula e espaços. `SignedMoney` aceita negativo, mas recusa `-0.00`.
- Converta `Money` com `Decimal`, nunca com `Number`.

## 8. Error Handling

| Código                      | HTTP | Campos além de `error` e `code` |
| --------------------------- | ---- | ------------------------------- |
| `SUBSCRIPTION_RESTRICTED`   | 402  | —                               |
| `PLAN_LIMIT_REACHED`        | 402  | `resource`, `limit`, `used`     |
| `MODULE_NOT_IN_PLAN`        | 402  | `feature`                       |
| `TENANT_ARCHIVED`           | 403  | —                               |
| `OWNER_REQUIRED`            | 403  | —                               |
| `FRESH_SESSION_REQUIRED`    | 403  | —                               |
| `PAYMENT_ACCOUNT_NOT_READY` | 409  | —                               |

`error` é a mensagem em pt-BR, como no resto da API. Exemplo de texto para o
limite: "Seu plano permite até 30 equipamentos (você tem 30). Nada foi apagado.
Para cadastrar mais, mude de plano."

## 9. Performance and Accessibility

- Contrato puro e universal (só zod).
- A interface nunca é a única barreira; o backend sempre confere.

## 10. Tests and Validation

- `pnpm exec vitest run --config vitest.platform.config.ts packages/contracts`
- Os testes provam: os oito módulos e as duas cotas exatos; formato estrito em
  todos os níveis; cota e módulo com tipo certo; `Money` sem `number` (T-D2);
  status HTTP de cada código; envelopes estritos e `used >= limit`.
- Onda 96: 51 casos novos, incluindo cota concorrente (10 cadastros, uma vaga,
  um sucesso), RLS com papéis separados, downgrade sem perda, lock até INSERT,
  exceções, savepoint em shadow e envelopes idênticos nos dois hosts. Os
  resultados consolidados e limites estão em `shared-api-host.md`.
- Onda 97: 337 casos distintos, 110 novos; matriz de admissão, handlers reais
  dos dois hosts, CSRF e mutações do inventário. Banco descartável com papéis
  separados prova isolamento de exceções, troca de dono e recuperação SQL em
  shadow. Resultados e pendências em `shared-api-host.md`.

## 11. Related Docs

- `docs/architecture/adr-saas-subscription.md`
- `docs/features/assinatura-plataforma.md`
- `docs/features/backoffice-plataforma.md` (exceções concedidas pela equipe)

## 12. Change Log

- 2026-09-26: Contrato de limites, dinheiro e erros de acesso criado (lote S0).
- 2026-09-26 (onda 3, commit `be859915`): direitos efetivos e avaliação de cota
  no domínio (lote S1).
- 2026-10-04 (onda 96, sem commit): admissão/cota transacional de equipamentos;
  S8 continua parcial, fiscalização de produção não ativada.
- 2026-10-04 (onda 97, sem commit): admissão HTTP comum; S8 ainda parcial,
  revalidação transacional dos demais comandos pendente.

---

_Template version: 2026-01-20_

## Onda 98 — comandos na transação (2026-10-04, sem commit)

`entitlements/command-admission.ts` protege logística/manutenção e PIX/boleto na
conexão da mutação. Direitos/obrigações são comuns ao gate HTTP; lock da
organização dura até commit. Shadow tem savepoint; off conserva legado. Boleto
manual de orçamento e demais comandos continuam pendentes; jobs aceitos não
receberam gate. 422 provas consolidadas, 93 novas: onda 98 de
`shared-api-host.md`. Fiscalização real permanece off.

## Onda 99 — boleto manual e obrigações (2026-10-04, sem commit)

Pedido manual de boleto usa requestQuoteBoletoPayment; o núcleo financeiro é
compartilhado com ensureQuoteBoletoPayment, reservado aos jobs já aceitos. Cada
preparação revalida plano/acesso, inclusive após consulta externa de histórico.
Envio revalida antes da notificação e exige onlinePayments no HTTP.
Retorno/fechamento estrito, PAID/SETTLED e reemissão vigente revalidam na
conexão da escrita e conservam as exceções RESTRICTED, sem permitir misturar
extensão ou reabertura. SETUP/ARCHIVED não recebem exceções. Fiscalização real
off; S8 continua parcial. Provas/limites: onda 99 de shared-api-host.md.

## Onda 100 — orçamento, locação e perfil (2026-10-04, sem commit)

Os comandos manuais de criação/alteração/exclusão/reajuste/conversão de
orçamento, criação/checkout/prorrogação/multa de locação, pedidos e remoção do
histórico revalidam acesso na conexão da mutação. A conversão de pagamento já
aceito usa o mesmo núcleo sem nova admissão manual, preservando idempotência e
estoque. Perfil próprio permite SETUP/RESTRICTED após lookup pelo
usuário/locadora do principal; ARCHIVED continua recusando. Essa exceção já
existia no gate HTTP.

760 casos distintos, 116 novos, passaram. S8 segue parcial: equipe ainda não
possui serviço de convite/gestão; a criação atual de Membership é CLIENT e não
consome staffSeats. A cota precisa acompanhar seu futuro consumidor real.
Comunicações, divulgação/site e matriz comercial/operacional restante continuam
pendentes. Fiscalização real off; detalhes/provas na onda 100 de
shared-api-host.md.

## Onda 101 — comunicação e documentos (2026-10-04, sem commit)

WhatsApp, rascunho/assinatura de contrato e envio de orçamento ajustado passam
pela admissão na conexão da escrita. whatsapp e contractSignature são módulos
respectivos; geração local de contrato e e-mail de sistema não exigem inbox ou
assinatura premium. Efeitos já aceitos continuam mesmo após restrição comercial;
novos pedidos são recusados. Lookup de contrato/orçamento conserva ownership
antes da recusa comercial.

437 casos distintos, 46 novos, passaram. Zoho ainda precisa de aceitação durável
para suas mutações externas; Merchant permanece em quarentena. S8/equipe/site e
aceites comerciais/operacionais continuam parciais, fiscalização real off.
Provas e próximo corte: onda 101 de shared-api-host.md.

## Admissão Zoho — onda 102 (2026-10-04, sem commit)

EmailInbox e acesso atual são revalidados com participação/conexão na transação
que aceita a mutação. Resultado aceito termina após downgrade; repetição com
chave estável não cria novo efeito. Modo off preservado. S8 permanece parcial,
com reconciliação/equipe/site/aceites reais pendentes.
[Provas e limites](../architecture/zoho-command-admission.md).

## Jobs de tenant: obrigação e divulgação — onda 130 (2026-10-06, sem commit)

O runner único `createTenantCron` (`packages/backend/src/http/tenant-cron.ts`),
ligado hoje por `apps/services/api/src/host/tenant-cron.ts`, só executa job
declarado no catálogo `TENANT_CRON_JOBS`. Na onda130 também era ligado pela
fachada antiga `lib/security/tenant-cron.ts`, retirada em F. Cada rota de cron
do host API informa `job: '<nome da rota>'`. O tipo recusa nome fora do catálogo
e chamada sem declaração; em tempo de execução, o runner responde 500
`Tenant cron job is not declared` depois da autorização e antes de qualquer
consulta ou job.

A agenda com orçamento de tempo vem inteira ou não vem: `checkpoint` (texto não
vazio), `budgetMs` (finito e maior que zero) e `minRemainingMs` (finito, zero ou
mais) andam juntos. O tipo recusa objeto parcial; em tempo de execução, agenda
parcial ou fora desses limites responde 500 `Tenant cron schedule is invalid`
depois da autorização e antes de qualquer consulta ou job. O job nunca roda sem
limite por causa de um prazo `NaN`; sem agenda, roda sem prazo, como antes.

| Job (`/api/cron/...`)    | Tipo           | O que faz                                                                    |
| ------------------------ | -------------- | ---------------------------------------------------------------------------- |
| `auto-convert-quotes`    | obrigação      | Converte orçamento pago                                                      |
| `boleto-overdue-alerts`  | obrigação      | Alerta de boleto vencido                                                     |
| `expire-quotes`          | obrigação      | Validade de orçamento                                                        |
| `late-fees`              | obrigação      | Multas                                                                       |
| `preventive-maintenance` | obrigação      | Manutenção preventiva da frota                                               |
| `send-notifications`     | obrigação      | Lembretes de devolução, atraso e manutenção                                  |
| `verify-boleto-payments` | obrigação      | Conferência de boletos, com orçamento de tempo e checkpoint                  |
| `sync-google-merchant`   | divulgação     | Em quarentena (503); declarado, ainda não chama o runner                     |
| `outbox`                 | fora do runner | Outbox, inbox, reemissão e conciliação; só organizações ACTIVE; nunca pula   |
| `platform`               | fora do runner | Jobs de plataforma (assinatura, conciliação, recuperação de provisionamento) |

Divulgação segue `PLATFORM_SUBSCRIPTION_ENFORCEMENT`:

- `off` ou ausente: todas as locadoras ACTIVE são tratadas como FULL; o acesso
  não é lido.
- `shadow`: o acesso é lido logo antes de cada locadora; SETUP, RESTRICTED,
  ARCHIVED, INACTIVE (saiu de ACTIVE depois da listagem) ou UNAVAILABLE (leitura
  falhou) gera `[tenant-cron-shadow]` com `{ tenantId, job, access }`, e o job
  roda mesmo assim. Falha do registro não bloqueia.
- `on`: roda só FULL. As demais saem em `skippedTenants`
  (`{ tenantId, access }`), sem job e sem checkpoint, e não contam em
  `deferredTenants`. Falha ao ler o acesso vira resultado 503 daquela locadora,
  sem executar.
- Valor inválido: 503 `Tenant cron policy unavailable`, sem listar locadoras.

Obrigação nunca lê a flag nem o acesso: roda em toda organização com
`status = ACTIVE`, inclusive SETUP, RESTRICTED e ARCHIVED, com a resposta de
antes (sem `skippedTenants`). O bloqueio administrativo (`Organization.status`)
continua excluindo a locadora da listagem para os dois tipos.

Limites: mudança de acesso durante a execução de um job não o interrompe; a
próxima execução já pula. A regra da matriz B.5 de ARCHIVED só com entrada e
conciliação para os jobs de obrigação não faz parte deste corte. A fiscalização
real continua off.

Provas: `packages/backend/src/http/tenant-cron.test.ts` (runner, inventário por
comportamento, recusa de job sem declaração e de agenda parcial ou não finita,
no tipo e em execução) e `tests/unit/tenant-cron-jobs.test.ts` (fachadas dos
dois hosts, rota real de multas nos dois hosts e declaração estática de todas as
rotas de cron).
