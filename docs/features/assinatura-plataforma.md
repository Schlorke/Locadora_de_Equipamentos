# Assinatura da plataforma

> **Status**: Critical **Last updated**: 2026-10-04

---

## 1. Purpose

A plataforma é um SaaS por assinatura: cada locadora paga uma mensalidade, que é
a única receita da plataforma. Esta página descreve o contrato da assinatura
(planos, estados, projeção de acesso, faturas e escritas permitidas com a conta
em pausa), definido pelo ADR `docs/architecture/adr-saas-subscription.md`
(seções B.3, B.5, B.6 e decisões D1, D6, D13, D14 e D23).

O lote S0 entrega o contrato em `@gb-locacoes/contracts/subscription`, e o lote
S1 a derivação pura do estado em `@gb-locacoes/domain/assinatura` (onda 3,
commit `be859915`). S2 e runtime de plataforma foram instalados nas ondas 85–86.
A primeira conciliação de faturas e projeção comercial entrou na onda 92; S6
continua parcial. S8 tem admissão compartilhada, com fiscalização real off;
emissão e ações da tela (S11b) permanecem parciais. As leituras do dono foram
instaladas na onda 104, e a consulta web/Expo na onda 105. Cancel/undo entraram
nas ondas 106–107; emissão inicial e activate nas ondas 108–109. A confirmação
web solicita a cobrança do plano persistido, sem presumir pagamento ou ligar
fiscalização. Reativação e confirmação web entraram nas ondas 110–111, mantendo
a conciliação da assinatura anterior antes da nova emissão. Troca de plano,
onboarding/backoffice e homologação externa ainda não estão completos.

### Domínio da assinatura (lote S1)

- `derivarEstado(fatos, agora, politica)` em
  `packages/domain/src/assinatura/estado.ts`: pura, com relógio injetado e dia
  civil de America/Sao_Paulo (inclusive horário de verão histórico). Aplica as 7
  regras da seção B.5 na ordem da ADR e devolve estado, acesso, regra aplicada,
  sinal `CANCEL_DUE` (`OWNER_REQUEST`, `NON_PAYMENT`, `TRIAL_EXPIRED`,
  `ABANDONED`) e a dívida (`desde`, dias em atraso, `toleranciaAte`, pausa,
  encerramento, `valorEmAberto` em `Decimal`). A ordem das faturas não muda o
  resultado; fatura duplicada idêntica conta uma vez e versões contraditórias
  lançam erro.
- Prazos implementados como na seção B.18: dia 1 de atraso é o primeiro dia
  vencido; `PAST_DUE` de D+1 a D+7, `SUSPENDED` a partir de D+8 e sinal de
  encerramento em D+37 (`POLITICA_COMERCIAL_PADRAO`: `graceDays` 7,
  `suspendDays` 30, `incompleteDays` 30). A seção B.5 ("≤") e a régua da B.6
  ("D+7 SUSPENDED") divergem disso; a correção da ADR está pendente.
- `transicaoPermitida` e `TRANSICOES_DA_ASSINATURA` seguem a tabela literal do
  diagrama. Saltos legítimos (`ACTIVE → SUSPENDED` depois de queda do cron,
  `INCOMPLETE → PAST_DUE` com chargeback antes do recompute) ainda não estão na
  tabela: decisão pendente do S6.
- `planejarTrocaDePlano` (sem pró-rata; upgrade imediato em TRIALING/ACTIVE,
  downgrade no fim do período, recusa em INCOMPLETE, SUSPENDED e CANCELED) e
  `planejarReativacao` (só CANCELED; perdoa OVERDUE e PENDING vencida; nova
  assinatura começa INCOMPLETE e sem teste).
- `Dinheiro` é `Decimal | string`; `number` é recusado no tipo e em tempo de
  execução.

## 2. Scope

**In scope**

- Seis estados da assinatura: `INCOMPLETE`, `TRIALING`, `ACTIVE`, `PAST_DUE`,
  `SUSPENDED` e `CANCELED`.
- Projeção em `Organization.access`: `SETUP`, `FULL`, `FULL`, `FULL`,
  `RESTRICTED` e `ARCHIVED`, nessa ordem (D6). Nenhum estado apaga dados.
- Catálogo público de planos (`GET /api/public/plans`), resumo da assinatura do
  dono (`GET /api/admin/subscription`), faturas
  (`GET /api/admin/subscription/invoices`) e histórico (`SubscriptionEvent`).
- Ações do dono sem pró-rata: trocar de plano e reativar (com `planVersionId`);
  ativar, cancelar e desfazer o cancelamento (sem corpo).
- `RESTRICTED_MUTATION_ALLOWLIST`: as únicas escritas aceitas em `RESTRICTED`.
- Enumerações espelhadas do schema Prisma da seção B.3 (intervalo, modo de
  cobrança, sincronização com o provedor, origem do evento, tipo, estado e
  motivo de cancelamento da fatura, modo do site e flag de fiscalização).

**Out of scope**

- `derivarEstado` e `transicaoPermitida` (domínio, lote S1).
- Chamadas ao Asaas, régua de cobrança e reconciliação (lote S6).
- Bloqueio por acesso nas rotas e nos jobs (lote S8).
- Troca de intervalo mensal/anual: o MVP vende só mensal.

## 3. Entry Points

- Contrato: `packages/contracts/src/subscription.ts`, exportado como
  `@gb-locacoes/contracts/subscription`.
- Leituras instaladas em ambos os hosts: `GET /api/public/plans` (onda 103),
  `GET /api/admin/subscription` e `GET /api/admin/subscription/invoices` (onda
  104).
- Escritas instaladas nos dois hosts (B.13):
  `POST /api/admin/subscription/{activate,cancel,undo-cancel,reactivate}`.
- Escritas ainda pendentes: `POST /api/admin/subscription/change-plan`.

## 4. Core Flow

1. O cadastro cria a assinatura em `TRIALING` (plano com teste e teste inédito)
   ou em `INCOMPLETE` (sem teste).
2. A primeira fatura paga leva a `ACTIVE`. Fatura vencida leva a `PAST_DUE`
   (tudo funciona até `graceEndsAt`), depois a `SUSPENDED` (painel em leitura,
   site em pausa) e, sem pagamento, a `CANCELED`.
3. Cada mudança de estado grava o `SubscriptionEvent` e atualiza
   `Organization.access` com `SUBSCRIPTION_ACCESS` /
   `accessForSubscriptionStatus`.
4. Em `RESTRICTED`, uma mutação só passa se a rota declarar
   `allowWhenRestricted` com um código de `RESTRICTED_MUTATION_ALLOWLIST`; o
   resto responde 402 `SUBSCRIPTION_RESTRICTED`.
5. `CANCELED` é terminal; reativar cria uma nova assinatura, sem teste.

## 5. Components and Files

- `packages/contracts/src/subscription.ts`
- `packages/contracts/src/subscription.test.ts`
- `packages/contracts/src/entitlements.ts` (`Money`, `EntitlementsV1`)

## 6. Data and State

- Tabelas futuras (S2): `plans`, `plan_versions`, `subscriptions`,
  `subscription_events`, `platform_invoices`.
- Dinheiro trafega como string decimal com duas casas (`"149.90"`), nunca como
  `number`; datas civis (`@db.Date`) como `AAAA-MM-DD`; instantes como ISO 8601
  com fuso.
- `invoiceUrl` só é aceito em `https://*.asaas.com`, sem credenciais na URL.
- Serviço externo (lotes seguintes): Asaas, conta raiz.

## 7. Constraints and Edge Cases

- `SubscriptionSummarySchema` recusa `access` que não seja a projeção de
  `status`, `scheduledPlan` sem `scheduledChangeAt` (e vice-versa) e
  `canceledAt` fora de `CANCELED`.
- Plano público nunca custa zero; valor zero só em plano interno (ex.:
  "Fundador").
- Prazos da versão do plano: teste de 0 a 30 dias, carência de 0 a 15 e pausa de
  7 a 90 (CHECKs do banco).
- O resumo não expõe ids do provedor, `billingEmail` nem `revision`.
- `PLATFORM_SUBSCRIPTION_ENFORCEMENT`: `off` trata tudo como `FULL`; `shadow` só
  registra; `on` aplica.

## 8. Error Handling

- Os códigos e envelopes de erro de acesso ficam em
  `docs/features/limites-plano.md` (`SUBSCRIPTION_RESTRICTED`,
  `TENANT_ARCHIVED`, `OWNER_REQUIRED`, `FRESH_SESSION_REQUIRED`).
- Todo corpo de erro segue o padrão da API: `{ error, code }`, com mensagem em
  pt-BR.

## 9. Performance and Accessibility

- Contrato puro e universal (só zod): roda no navegador, no Node e no app
  mobile, sem Node built-ins, DOM nem `process.env`.
- A interface (S11b) mostra o estado com texto, não só com cor.

## 10. Tests and Validation

- `pnpm exec vitest run --config vitest.platform.config.ts packages/contracts`
- `pnpm exec tsc -p packages/contracts/tsconfig.json`
- Domínio (S1):
  `pnpm exec vitest run --config vitest.platform.config.ts packages/domain`. Os
  testes de `packages/domain/src/assinatura` cobrem a linha do tempo D0 a D+38,
  a virada de 23:59:59 para 00:00 em São Paulo, estorno voluntário e
  involuntário, chargeback, cortesia com prazo, 24 permutações e a tabela
  completa de transições, com 100% de ramos nos arquivos novos.
- Os testes provam: os seis estados e a projeção exata; a lista de exceções em
  `RESTRICTED`; plano público sem valor zero e com direitos estritos; datas e
  URLs de fatura validadas; objetos estritos sem dados do provedor.

## 11. Related Docs

- `docs/architecture/adr-saas-subscription.md`
- `docs/features/limites-plano.md`
- `docs/features/onboarding-locadora.md`
- `docs/features/conta-recebimentos.md`
- `docs/features/backoffice-plataforma.md`

## 12. Change Log

- 2026-09-26: Contrato da assinatura criado (lote S0).
- 2026-09-26 (onda 3, commit `be859915`): derivação do estado, política
  comercial, troca de plano, reativação e direitos efetivos no domínio (lote
  S1).

---

_Template version: 2026-01-20_

## Fundação S2 de dados (2026-10-03, onda 85)

Schema comercial, plano interno/backfill, sete migrations, papéis DBA e RLS
implementados localmente; 17 modelos PLATFORM separados dos 31 tenant.
Organizações atuais conservam acesso e recebem assinatura interna gratuita;
novas nascem SETUP. Sem preço comercial inventado, chamada Asaas ou cutover.
Pool/runner/outbox e cron da plataforma foram instalados na onda 86, com
composição compartilhada e papel isolado. O primeiro job reutiliza a limpeza
existente de janelas vencidas de rate limit; inbox/consumidores comerciais,
cobrança S6 e acesso S8 continuam pendentes. Detalhes, comandos e provas: seções
ondas 85 e 86 de [API compartilhada](shared-api-host.md).

## Consumidor de faturas S6 (2026-10-03, onda 92, sem commit)

PAYMENT da conta raiz é confirmado por GET no provedor usando somente
PLATFORM_ASAAS_ROOT_API_KEY e ambiente explícito. A composição instala o tópico
subscriptions.invoice.webhook no cron existente; ausência de configuração mantém
o job pendente, sem emprestar chave de locadora. SUBSCRIPTION ainda não tem
consumidor. Não há nova agenda ou mudança de URL configurada.

modules/subscriptions recebe portas de transação/leitura. O adapter HTTP
pertence a billing, e periodoMensal/derivarEstado permanecem no domínio. Uma
transação grava fatura, histórico, projeção e outbox; locks de
organização/assinatura e revisão do binding protegem concorrência. Recibo
conflitante durante a consulta não aplica resultado. Falha SQL desfaz todos os
efeitos e permite retry.

Ciclo mensal parte do vencimento civil e termina na véspera do aniversário do
mês seguinte, com ajuste para o último dia válido. Money usa Decimal; valor,
cliente ou referência divergentes exigem conciliação. PAID não regride para
pendência; REFUNDED permanece final. CHARGEBACK pode voltar a PAID somente pela
confirmação atual do provedor. Status desconhecido conserva o estado local de
uma fatura existente, registra o código e a auditoria, sem apagar dívida.

Assinatura cancelada permanece terminal e não altera o acesso de uma substituta.
Bloqueio administrativo da Organization é preservado. CANCEL_DUE grava o estado
local e enfileira subscriptions.provider-deactivate; transição enfileira
subscriptions.notify. **Os dois consumidores ainda faltam:** este incremento não
desativa uma assinatura no Asaas nem envia e-mail. Recomputação periódica,
emissão/UNKNOWN, eventos SUBSCRIPTION e S8 também faltam.

Contrato de fatura aceita o billingType RECEIVED_IN_CASH, observado no provedor;
nenhum plano/preço comercial foi criado. Valores de testes são sintéticos.
Provas, limites e próxima etapa: onda 92 de
[API compartilhada](shared-api-host.md).

## Leituras do dono (2026-10-04, onda 104, sem commit)

GET /api/admin/subscription e /invoices estão instalados nos hosts legado e
compartilhado. A consulta exige dono atual e vínculo ADMIN ativo, verificados
sob RLS na mesma transação RepeatableRead/READ ONLY da leitura. Direitos
reaproveitam a regra de exceções; uso conta modelos e equipe ativa não CLIENT.
Acesso persistido deve corresponder ao estado; dado inválido não é corrigido por
GET. Legado sem assinatura recebe 404, sem plano fictício; histórico de faturas
vazio continua válido.

A exceção de S8 é só para as leituras exatas do dono: SETUP, FULL, RESTRICTED e
ARCHIVED; não permite escritas nem subrotas. O resumo usa a assinatura viva, ou
a última cancelada; faturas incluem as assinaturas anteriores da mesma locadora,
até as 100 mais recentes por vencimento/criação/id. Não há paginação no contrato
atual. Valores/datas/links são validados pelos schemas já existentes. Todas as
respostas destas leituras são private, no-store e variam por Cookie/Host.

Backend: modules/subscriptions/owner-read.ts e http/owner-subscription.ts.
Composição: lib/subscription-read.ts e
apps/services/api/src/host/subscription-read.ts. 185 unitários, 126 banco/RLS e
78 estruturais passaram; 24 cenários HTTP em cada modo NextAuth/Better Auth,
tipos/gates e os dois builds também. Somente dois tipos com consumo real saíram
da baseline de higiene; não houve tolerância nova. Emissão, ações, telas,
onboarding/backoffice e aceites externos continuam pendentes. Fiscalização off e
legado/scheduler preservados.
[Provas e fronteiras](shared-api-host.md#onda-104--assinatura-e-faturas-do-dono-2026-10-04-sem-commit).

## Catálogo público — onda 103 (2026-10-04, sem commit)

GET /api/public/plans foi composto nos dois hosts pelo mesmo backend. A leitura
usa papel SQL isolado em transação READ ONLY e devolve apenas versões públicas
vendáveis no contrato PublicPlansResponse. Valores trafegam como strings
decimais; ofertas mensais/anuais e versões sobrepostas não são descartadas.
Planos internos/arquivados, preços zero e janelas futuras/encerradas ficam fora.
Catálogo vazio é permitido; os preços, nomes e limites comerciais continuam
dependendo do dono. Nenhum cadastro comercial, cobrança ou flag foi ativado.

Mais de dez ofertas vigentes ou dados públicos inválidos falham com 503 neutro;
o operador deve corrigir o catálogo, sem truncamento silencioso. Sem
PLATFORM_DATABASE_URL isolada não existe fallback. O cadastro futuro precisa
revalidar a oferta durante a criação da assinatura, pois a leitura pode ser
cacheada por até 60 segundos. O bloco passou em 502 casos distintos, incluindo
READ ONLY real, isolamento SQL e recusa neutra nos dois hosts; nenhum plano
comercial ou provedor foi ativado. S6/UI/onboarding/backoffice continuam
parciais. [Provas e limites](shared-api-host.md).

## Reconciliação e cancelamento S6 (onda 93, 2026-10-03, sem commit)

O runtime do cron existente compõe reconciliação em lotes de 20 e desativação
externa com a configuração explícita da raiz. Webhook/job compartilham aplicação
dos fatos e projeção. Trials locais avançam sem chave; UNKNOWN usa referência
sem repetir POST; divergência financeira preserva acesso e gera auditoria.
Retry-After também é aplicado à entrega da outbox.

PUT INACTIVE confirmado encerra recorrência sem apagar histórico. Só o
cancelamento OWNER_REQUEST considera excluir cobrança futura não paga; dívida
anterior e cobrança paga permanecem. providerCancelState interno persiste
intenção antes do DELETE da cobrança e protege retry incerto/crash. 404 não
confirma cancelamento. Sem recorrência externa vinculada, não é criado job de
desativação.

53 testes de banco e 40 HTTP/retry passaram localmente, com tipos/gates e builds
dos dois hosts. Não certificam o Asaas real. S6 segue parcial: emissão, eventos
SUBSCRIPTION, notificações/régua e saúde diária do webhook faltam, além de
S8/onboarding/backoffice. Detalhes e limites na onda 93 de
[API compartilhada](shared-api-host.md).

## Eventos e recuperação comercial S6 (onda 94, 2026-10-03, sem commit)

SUBSCRIPTION é um gatilho de reconciliação durável, com confirmação dos fatos
pelas portas já usadas pelo webhook PAYMENT e pelo job periódico. PROCESSED no
recibo comprova o handoff; a execução seguinte fica registrada na outbox.
Payload não confirma pagamento/cancelamento. Conflito posterior e vínculo
divergente impedem a gravação de fatos/projeção. Cancelamento durante criação
UNKNOWN recupera o ID por referência e confirma INACTIVE, sem repetir criação.

Novos recibos da raiz conservam ambiente imutável pela migration 202610030112;
recuperação de UNROUTED usa esse ambiente e o mesmo resolvedor do ingresso,
conservando hash/payload/identidade. Linha antiga sem ambiente não é presumida.
94 casos de banco passaram localmente; detalhes, gates e limites na onda 94 de
[API compartilhada](shared-api-host.md). S6 continua parcial: emissão,
notificações/régua e saúde diária faltam, junto de S8/onboarding/backoffice e
aceite real. API legada e scheduler permanecem ativos.

## Avisos e régua S6 (onda 95, 2026-10-03, sem commit)

O cron existente compõe subscriptions.notify/dunning/mail com Resend
configurado. Sem chave/remetente/ambiente/host explícitos, avisos ficam PENDING.
Seleção usa fatos puros e dias civis; transição superada, fatura paga e contato
revogado são revalidados antes do envio. Contatos de cobrança e memberships
financeiras ativas recebem jobs privados, sem papel global ou dados de outra
locadora.

Envelope e primeira tentativa são duráveis; chave/conteúdo permanecem no retry.
Depois de 23h de envio incerto, auditoria exige conciliação, sem repetição cega.
Aceite do Resend não prova entrega na caixa postal. CTA geral usa /admin atual;
link de fatura é https do Asaas validado. Tela de assinatura e enforcement S8
não foram prometidos como concluídos. Datas da régua seguem o domínio existente,
com a divergência histórica da ADR ainda explícita.

316 casos distintos passaram localmente, 52 novos; tipos/lint/gates e builds
API/legado passaram. Nenhum e-mail real, scheduler novo, produção ou retirada do
legado. S6 ainda exige emissão, saúde diária e tela; S8/onboarding/backoffice e
aceite operacional continuam pendentes. Provas e limites: onda 95 de
[API compartilhada](shared-api-host.md).

## Consulta do dono no web/Expo (onda 105, 2026-10-04, sem commit)

O destino /admin/assinatura usa entities/assinatura e pages/assinatura-admin,
sem regra comercial nos hosts. A variante web consulta os dois GETs privados da
onda 104: plano atual, seis estados, datas, quotas/uso, recursos e faturas
históricas, inclusive anteriores. Valores são formatados a partir de strings
decimais; datas civis não passam por conversão de fuso. Links de fatura https
validados abrem em nova aba sem referrer ou acesso à janela original.

A variante Expo só consulta o resumo, exibe estado/plano/faixa e abre o painel
web autenticado. Não consulta faturas, compra ou backoffice no app, conforme
B.13 da ADR. EXPO_PUBLIC_WEB_URL informa somente a origem do painel (https em
produção); ausente/inválida impede a abertura, sem usar a origem da API.
Locadora na URL é indicação de seleção, não autorização, e credenciais do app
não são transportadas.

No dashboard e menu, o item só aparece após resposta autorizada da consulta. 403
oculta os dados; ADMIN global não prova dono. 404 SUBSCRIPTION_NOT_FOUND exibe
ausência de assinatura sem plano inventado. 401/409 e falha de transporte têm
estados próprios. Uma recusa das faturas descarta também o resumo; mudança de
usuário/vínculo/locadora/transporte limpa a tela imediatamente e ignora
respostas antigas. Atualizar consulta não altera fatos comerciais.

94 testes focados, 95 mobile e 184 web passaram; Chromium cobriu os seis estados
e recusa de dono em duas larguras. Dashboard conserva estilos da baseline.
Builds/exports não certificam aparelho ou cobrança real. O teste global Tailwind
encontrou 12 classes anteriores sem fixture (entrada 287); não foi relaxado.
Ações comerciais, emissão, onboarding, backoffice e operação continuam parciais;
legado e scheduler ativos, fiscalização off.
[Checkpoint e limites](shared-api-host.md#onda-105--consulta-da-assinatura-nos-clientes-2026-10-04-sem-commit).

## Cancelar e desfazer no backend (onda 106, 2026-10-04, sem commit)

POST /api/admin/subscription/cancel e /undo-cancel existem no legado e no host
compartilhado. Exigem principal ADMIN, dono/vínculo ativos revalidados sob
trava, autenticação real há no máximo dez minutos e Idempotency-Key. Erro de
sessão antiga é 401 FRESH_SESSION_REQUIRED; renovar cookie não é autenticar
novamente. Corpo vazio ou JSON {} de até 1 KiB; accepted:true confirma somente a
transação local. Releia o resumo para apresentar o estado.

Cancelamento protege a cortesia/período pago e encerra teste imediatamente;
desfazimento só ocorre antes do dia devido. Recibo inclui no-op e não reaplica
pedido antigo depois de desfazer ou substituir assinatura. Projeção/outbox usam
os serviços atuais, sem chamada ao Asaas no request, DELETE de assinatura ou
remoção de dívidas. UNKNOWN segue para reconciliação antes de inativar.

A UI segue de consulta; ainda não expõe estes comandos. Fiscalização off e
API/scheduler legados preservados. Provas, arquivos e limites estão na
[onda 106 do host compartilhado](shared-api-host.md#onda-106--cancelamento-pelo-dono-2026-10-04-sem-commit).

## Confirmação no web (onda 107, 2026-10-04, sem commit)

Cancelar/desfazer agora têm confirmação explícita na página do dono. O resumo
autorizado decide qual controle apresentar; CANCELED/ausência não permitem estes
comandos. O backend mantém propriedade, prazo e projeção. Recibo local
accepted:true provoca releitura de resumo/faturas; efeito externo não é
presumido. Falha incerta exige retry manual com a mesma chave, sem envio
automático ou armazenamento persistente. Mudança de escopo/resumo encerra a
confirmação anterior e ignora retorno antigo.

FRESH_SESSION_REQUIRED oferece login existente em modo de reautenticação: cookie
aberto não redireciona automaticamente. Retorno só leva rota/locadora, nunca
comando/chave; autenticar não executa o pedido. Depois a pessoa revisa e
confirma novamente. A flag da tela não concede frescor ou propriedade. Expo
continua com estado/link, sem faturas/comandos dentro do app, conforme a ADR.

179 focados, 185 web, 95 mobile, 16 Chromium, tipos/gates e builds web/legado
aprovados. Capturas inspecionadas em 390/1440 px; fixtures não certificam
provedor real/aparelho ou login contra os motores compilados. Ativação,
troca/reativação/onboarding/backoffice e operação continuam parciais.
[Provas e limites](shared-api-host.md#onda-107--confirmacao-e-reautenticacao-no-web-2026-10-04-sem-commit).

## Ativação e emissão (onda 108, 2026-10-04, sem commit)

POST /api/admin/subscription/activate usa o mesmo envelope sensível e a
infraestrutura de comandos da onda 106. Apenas o dono atual com sessão recente
pede emissão do plano mensal já registrado, com perfil/aceites persistidos;
accepted:true confirma intenção/outbox, não pagamento ou criação no provedor.

O consumidor subscriptions.provider-sync procura e cria primeiro o cliente e
persiste seu id antes da recorrência. O cron existente atende pedido explícito,
cadastro sem teste ou D-7 do teste. UNKNOWN/queda só consultam referências, sem
repetir o POST incerto. Divergência vai para quarentena; cancelamento durante
I/O mantém histórico/CANCELED e enfileira inativação. ACTIVE depende da
conciliação de faturas, não da criação da recorrência.

Não foram criados planos/preços/textos legais públicos, novo cron ou migração;
fiscalização real continua off e legado ativo. Consumidor web de ativação,
troca/reativação/onboarding/backoffice e homologação externa ainda pendentes.
515 provas locais e seis verificações HTTP passaram; não há aceite do Asaas
real.
[Detalhes e limites](shared-api-host.md#onda-108--ativacao-e-emissao-da-mensalidade-2026-10-04-sem-commit).

## Confirmação de ativação no web (onda 109, 2026-10-04, sem commit)

A tela do dono oferece Ativar assinatura para ASAAS mensal/positivo em
INCOMPLETE/TRIALING, sem cancelamento agendado. Isso é uma affordance da tela:
propriedade, sessão recente, plano, perfil/aceites e sincronização continuam
revalidados pelo backend. Não há preço/plano escolhido ou calculado no cliente.
A confirmação mostra o nome e a mensalidade já lidos; Voltar não envia nada.

owner-action/use-owner-action/SubscriptionActions substituem os arquivos
exclusivos de cancelamento e compartilham transporte, estado e diálogo com
activate. Uma intenção incerta conserva sua ação/chave e bloqueia outro comando;
repetição é manual. Escopo/resumo alterados invalidam confirmação e resposta
tardia; accepted só relê resumo/faturas e informa que pagamento ainda precisa de
confirmação. Cadastro/aceites incompletos têm mensagens neutras; a exigência de
sessão recente abre login sem transmitir comando ou chave.

180 casos focados e 18 cenários Chromium em 390/1440 px passaram, incluindo
cancel/undo, foco, repetição e consulta nativa sem compra. Capturas locais
inspecionadas, tipos/gates e builds web/legado aprovados. Não há homologação de
Asaas/aparelho/login real ponta a ponta. Troca/reativação,
onboarding/backoffice, aprovação jurídica/comercial e demais aceites permanecem
pendentes. Legado ativo e fiscalização off.
[Provas e limites](shared-api-host.md#onda-109--ativacao-confirmada-no-web-2026-10-04-sem-commit).

## Reativação com nova assinatura (onda 110, 2026-10-04, sem commit)

POST reactivate recebe o planVersionId de uma oferta pública mensal/vendável. O
dono atual com sessão recente pede outra assinatura INCOMPLETE sem teste; a
anterior não muda de identidade, plano, cobrança ou estado terminal.
Perfil/aceites e chave scoped são exigidos; repetir não duplica, e a mesma chave
com outro plano ou ação recusa. Perdão das vencidas, vínculo histórico, SETUP e
outbox são atômicos.

Antes da emissão, o worker existente confirma INACTIVE e concilia a exclusão das
vencidas; recurso incerto só é consultado. Fatura paga não é apagada e gera
auditoria manual; perdão local não reabre cobrança pendente. Activate, cron e
uma segunda reativação respeitam a dependência anterior. A emissão posterior usa
sub:<novoId> e depende de pagamento conciliado para ACTIVE.

480 provas locais e dez verificações HTTP passaram. UI da reativação, backoffice
de alertas, Asaas real e aceites externos permanecem pendentes. A hierarquia
comercial para upgrade/downgrade foi solicitada ao dono; não se deduziu do preço
ou sortOrder. Legado ativo, fiscalização off.
[Detalhes e limites](shared-api-host.md#onda-110--reativacao-duravel-pelo-dono-2026-10-04-sem-commit).

## Confirmação de reativação no web (onda 111, 2026-10-04, sem commit)

Depois de consultar o resumo do dono CANCELED, a tela lê as ofertas públicas
mensais e exige escolha explícita. A confirmação mostra nome/mensalidade, sem
teste, preservação de pagamentos e conciliação anterior. Corpo contém somente
planVersionId; accepted apenas relê estado/faturas. Voltar não executa o pedido.

A intenção incerta conserva plano/chave, trava escolha e só repete após clique.
Mudança de oferta antes de enviar exige nova revisão; mudança de
sessão/locadora/ resumo fecha confirmação e ignora retorno antigo. Login recente
não recebe plano/comando/chave nem executa a ação depois de autenticar. Catálogo
vazio ou falho não inventa oferta. Mobile continua estado/link, sem compra no
app.

226 casos e 20 Chromium em 390/1440, tipos/gates/builds locais aprovados;
capturas inspecionadas. Asaas real, operação, troca de plano,
onboarding/backoffice e aprovação de planos/textos continuam pendentes. Legado
ativo/fiscalização off.
[Detalhes e limites](shared-api-host.md#onda-111--reativacao-confirmada-no-web-2026-10-04-sem-commit).
