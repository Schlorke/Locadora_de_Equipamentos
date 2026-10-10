# AI Context Map

Continuidade vigente da onda 135 — decisão humana de 2026-10-09: interface
aceita. A primeira etapa C foi publicada em `Schlorke/Locadora_de_Equipamentos`
no commit `978ceb9244c81c7cb2888b798fad8ce90edad25e`, com a tag
`checkpoint/onda-135-pre-exclusao`. Essa história inicial limpa não inclui os
pais antigos, preservados somente no arquivo local. Não publicar o histórico com
segredos nem alterar/revogar credenciais reais, que podem ser compartilhadas com
a GB. Infraestrutura hospedada, banco de produção e provedores serão escolhidos
depois conforme a decisão do usuário. Migrations no PostgreSQL local descartável
não criam nem homologam conta, banco ou provedores de produção.

**Checkpoint da base preparada — 2026-10-09, checkpoint pré-publicação:** **base
preparada no clone; unit, P2, B11 e visual fechados no escopo declarado**. Unit
4.104/4.104 sem skips, P2 v6 e B11 v3 no escopo declarado e visual F
80/536/31.065 sem pendências têm recibos próprios. Gates documentais executarão
após aplicação. Dispositivos, Slow 3G completo e foundations NOT_PROVEN
continuam separados. Para retomar, ler o
[guia F](../guides/wave135-retirement-validation.md), seu
[ledger](../guides/wave135-retirement-validation.ledger.json) e o início de
`CLAUDE_TO_CODEX_HANDOFF.md`. Contratos e evolução do produto permanecem em
`docs/architecture/modernization.md` e `docs/features/shared-api-host.md`. As
provas locais estão em `%TEMP%/locadora-wave135-finish-20261009` (`FINISH`).

As primeiras rodadas unit 245 passes/2 falhas, identidade 796/1 e segurança
921/31 com 18 skips são **históricas**, anteriores às correções e aos recibos
finais do guia F. O `arch.log` anterior à retirada também é histórico: zero
DOM/web universal e 43 ocorrências em 16 arquivos legados não representam a
medição final do clone. `visual-human-acceptance.json` registra o aceite C;
`reviews/` conserva auditorias, payloads e o plano, sem substituírem execução.

No clone independente `FINISH/p2/aposentar-raiz`, as antigas raízes `app/`,
`lib/`, `middlewares`, `schemas`, `types/global.d.ts`,
`types/google-maps-ecl.d.ts` e `proxy.ts` foram retiradas. Os owners atuais são
os hosts/pacotes, `public` como browser-assets, `design-tokens` como
compatibilidade gerada e `types/next-auth.d.ts` como shim só de tipos. Estado
salvo antes da publicação: F está no clone independente;
transferência/revalidação, commit/push e CI final F são passos posteriores com
recibos externos. Nenhum SHA futuro é antecipado. As 173 entradas aceitas de
hygiene são dívida declarada, não prova de zero código morto.

Os marcos por onda abaixo conservam a fotografia de sua execução. Não instruem
restaurar fachadas antigas ou repetir provas fechadas sem mudança relevante. A
autorização de publicação e o aceite humano substituíram os bloqueios históricos
correspondentes; produção e corte continuam separados.

Criação da conta de recebimentos (onda 134, S9): conta-recebimentos.md,
docs/operations/runbook-asaas-subaccount.md e shared-api-host.md, onda 134.
Faturamento mensal exato (decisão de 2026-10-06; a ressalva da onda 129 abaixo
foi resolvida), rotas `create` nos dois hosts, worker e manutenção nos crons,
saúde da subconta com integração ativa só na aprovação e barreira 409
PAYMENT_ACCOUNT_NOT_READY. Tudo atrás de PLATFORM_SUBACCOUNT_CREATION=off;
nenhuma flag real foi ligada.

Onda 129: uncertain-provisioning inspeciona UNKNOWN via conta raiz, sem POST ou
aprovação; fila/runtime únicos nos dois cron hosts. Referência confirmada sem
chave vira recuperação manual, com auditoria atômica. Conta-recebimentos.md,
shared-api-host.md e entrada 302 registram provas e limites. Faturamento mensal
ou faixas aguarda decisão humana; não converter arbitrariamente nem instalar
criação HTTP antes de resolver coleta/persistência. Legado/flags reais ativos.

Use this map to decide which docs to open based on the task type.

Onda 128: nova conferência após conclusão cria incidente confirmado e preserva
histórico; PENDING reutiliza agenda sem antecipar espera, PROCESSING/lease
impedem troca e incompleto retoma cursor. Job revalida incidente após I/O. Ver
conta-recebimentos.md, entrada 301 e shared-api-host.md. Runbook operacional em
docs/operations/runbook-asaas-webhooks.md; retomada real não foi executada nem
automatizada. Legado e flags reais preservados.

Recebimentos do dono: onda 120 de shared-api-host.md, conta-recebimentos.md e
entrada 294. GET comum nos dois hosts e /admin/recebimentos em FSD; RLS do papel
de negócio, snapshot READ ONLY, dono atual e projeção sem segredos. 460 provas
dirigidas, três builds, gates e 42 verificações HTTP/Chrome locais; moldura
compartilhada e seletor acessível no main (entrada 295). Onda 121 instala a
conexão inicial por POST nos dois hosts: CNPJ por GET, cofre/conta/auditoria
atômicos, dono revalidado e restrição até configurar eventos. Onda 124 monta o
formulário web no mesmo contrato, com chave efêmera e GET após aceite. 228 casos
focados e Chromium com fixtures passaram. A onda 125 identifica Host substituído
pelo fetch na sonda anterior; usando o helper HTTP existente, vinte casos pelo
proxy real passaram em cada motor nos dois backends. Origem/papel/cache são
preservados (entrada 300). A onda 126 comprova aceite 202 do dono pelo proxy,
com sessões reais, cofre e papéis canônicos em banco descartável: 38 casos HTTP
por motor e 32 unitários associados. Provedor sintético local, sem Asaas real.
Conclusão operacional, criação/documentos/saque e homologação seguem pendentes.
Chrome ainda usa fixtures; a prova integrada nova é HTTP. Legado/flags reais
preservados.

Onda 127: conta-recebimentos.md descreve GET/POST de recovery e confirmação no
painel. Payment-accounts produz/projeta recibos sanitizados do incidente/chave;
runtime usa apenas a outbox existente. Consulta é READ ONLY no papel de
plataforma; comando não chama provedor ou libera recebimentos. Provas e limites
em shared-api-host.md, onda 127. Nenhum grant, baseline ou flag real mudou.

Onda 122: configuração inicial e inspeção diária da conta conectada no tópico
payment-accounts.health, com hash de autenticação recuperável e intenção
anterior à escrita externa. Saúde por evento não apaga essa intenção nem a
necessidade de reconciliação. Quatro estados APPROVED são exigidos. Ver
conta-recebimentos.md, onda 122 de shared-api-host.md e entradas 297–298.
Liberação da reconciliação, subcontas e homologação permanecem pendentes; nenhum
cutover.

## Task -> Primary Docs

Onda 123: billing/account-payment-reconciliation recupera tentativas da fila
interrompida, com papel de negócio, cursor por incidente/chave, RLS e páginas de
até cinco consultas. Configuração conserva a restrição; fotografia completa não
prova endpoint reparado nem autoriza PUT de reativação. Ver
conta-recebimentos.md, modernization-billing.md, onda 123 de shared-api-host.md
e entrada 299. 251 provas locais e dois builds; legado/flags reais preservados,
~60% geral estimado.

| Task                                               | Read First                                                    | Then Check                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bugfix                                             | `docs/issues/known-issues.index.md`                           | `docs/issues/known-issues.md` (targeted search)                                                                                                                                                                      |
| UI/Component change                                | `docs/features/<component>.md`                                | `docs/features/design-system.md`, `docs/COMPONENT_INVENTORY.md`                                                                                                                                                      |
| Painel financeiro / cobranca                       | `docs/features/admin-financeiro-page.md`                      | `docs/features/admin-permissions-and-roles.md`, `docs/features/quote-system.md`                                                                                                                                      |
| Roles / permissoes                                 | `docs/features/admin-permissions-and-roles.md`                | `docs/features/admin-system.md`, `docs/issues/known-issues.md`                                                                                                                                                       |
| Documentos sensiveis do cliente                    | `docs/features/client-documents-antifraud.md`                 | `docs/features/contracts.md`, `docs/features/admin-system.md`                                                                                                                                                        |
| Performance React / refactor / data fetch / bundle | `docs/guides/performance-optimization.md`                     | `docs/guides/javascript-bundle-optimization.md`                                                                                                                                                                      |
| Admin area change                                  | `docs/features/admin-system.md`                               | `docs/features/admin-page-header-pattern.md`, `docs/features/admin-orcamentos-page.md`                                                                                                                               |
| Quote system                                       | `docs/features/quote-system.md`                               | `docs/features/quote-status-tracking.md`, `docs/features/quote-email-system.md`                                                                                                                                      |
| Dialogs/Modals                                     | `docs/features/dialog-lab.md`                                 | `packages/ui/src/web/`                                                                                                                                                                                               |
| 3D Carousel                                        | `docs/features/equipment-3d-carousel.md`                      | `packages/frontend/src/widgets/hero/ui/Equipment3DCarousel.web.tsx`, `ModelViewer.web.tsx` (seção 5.1 do `AGENTS.md`)                                                                                                |
| Assinatura SaaS (planos, onboarding, recebimentos) | `docs/architecture/adr-saas-subscription.md`                  | `docs/features/assinatura-plataforma.md`, `docs/features/limites-plano.md`, `docs/features/onboarding-locadora.md`, `docs/features/conta-recebimentos.md`, `docs/features/backoffice-plataforma.md`                  |
| Locadora por host / subdomínio / identidade        | `docs/architecture/adr-tenant-hosts.md`                       | `docs/features/tenant-hosts-web.md`, `docs/features/tenant-request-resolution.md`, `docs/features/tenant-client-enrollment.md`, `docs/features/tenant-directory-search.md`                                           |
| Conteúdo da vitrine / compromissos / textos legais | `docs/features/conteudo-da-vitrine.md`                        | `docs/features/identidade-da-vitrine.md`, `docs/features/site-por-estado.md`, `docs/operations/gb-site-settings.md`                                                                                                  |
| Segurança de API (guardas, CSRF, limitadores)      | `docs/architecture/security.md`                               | `docs/features/admin-permissions-and-roles.md` (seção 13), `docs/features/tenant-request-resolution.md`, `docs/issues/known-issues.md` (entradas 188 a 192 e 196)                                                    |
| Adapter do Asaas / cobranças                       | `docs/features/modernization-billing.md`                      | `docs/issues/known-issues.md` (entradas 173, 174, 187 e 199), `tests/helpers/fake-asaas/`                                                                                                                            |
| Dinheiro: quitação, multas, reemissão de boleto    | `docs/features/quote-system.md` (seções 3.3 e 7.4.1)          | `docs/issues/known-issues.md` (entradas 156, 186, 187 e 199), `packages/domain/src/locacao/saldo.ts`                                                                                                                 |
| Conciliação de cobranças legadas (centavos)        | `docs/guides/legacy-cents-reconciliation.md`                  | `docs/features/modernization-billing.md`, `scripts/ops/legacy-cents-report.ts`, `docs/issues/known-issues.md` (entradas 186 e 199)                                                                                   |
| Corte de produção / aposentar a raiz legada        | `docs/operations/runbook-corte-raiz-legada.md`                | `docs/operations/manifesto-variaveis.md`, `docs/guides/shared-api-acceptance.md`, `apps/services/api/vercel.json`, `apps/clients/web/vercel.json`                                                                    |
| Refatoração de CSS / visual                        | `docs/features/design-system.md` (seção "Arquitetura do CSS") | `tests/visual/README.md`, `docs/features/ratchet-gates.md`, `docs/issues/known-issues.md` (entradas 177 a 179, 194, 195 e 200 a 204)                                                                                 |
| Gates (arch, tokens, nomes de teste, higiene)      | `docs/features/ratchet-gates.md`                              | `docs/ai/boot.md` (regras permanentes), `tools/test-colocation-allowlist.json`, `knip.jsonc`, `tools/hygiene-baseline.json`                                                                                          |
| Estado da modernização                             | `docs/architecture/modernization.md`                          | Seções "Revisão adversarial da onda 3", "Onda 4" e "Onda 5", `docs/architecture/multiempresa.md`, `CHANGELOG.md` (Unreleased)                                                                                        |
| Dependencies update                                | `docs/references/dependencies.md`                             | `CHANGELOG.md`                                                                                                                                                                                                       |
| Database/Prisma                                    | `docs/architecture/overview.md`                               | `docs/internal/prisma-client-regeneration.md`, `docs/guides/ai-database-integration.md`                                                                                                                              |
| Deploy/CI                                          | `docs/getting-started/deployment.md`                          | `docs/guides/testing.md`                                                                                                                                                                                             |
| Security in docs                                   | `docs/internal/documentation-security-guidelines.md`          | `docs/architecture/security.md`                                                                                                                                                                                      |
| AI context/process                                 | `docs/ai/context-precision-protocol.md`                       | `docs/ai/context-capsule-template.md`, `docs/ai/context-capsules/README.md`, `docs/ai/context-intake-output-checklist.md`, `docs/ai/prompt-templates/README.md`, `docs/internal/ai-documentation-system-analysis.md` |

## Fast Lookups

Cadastro guiado web: onda 119 de shared-api-host.md e onboarding-locadora.md.
pages/onboarding monta sete etapas em app.<raiz>/comecar; host fornece rota,
login/captcha. Rascunho separado por dono, aceites desmarcados, catálogo vigente
e retomada manual com corpo/chave imutáveis. Confirmação de e-mail retorna ao
assistente. 117 casos, builds/HTTP off e 40 verificações Chrome com fixtures;
signup real off. Expo apenas estados/link, legado ativo, recebimentos/S13/
backoffice/operação pendentes.

Publicação do dono: onda 115 de shared-api-host.md e onboarding-locadora.md.
POST /api/admin/site/publish nos dois hosts usa modules/onboarding e composição
única runtime/platform-jobs. FULL/e-mail/dono revalidados; lock comum do
inventário, contagem RLS READ ONLY, data/auditoria atômicas e recibo repetível.
277 casos distintos locais. Não altera indexação/diretório; UI, despublicação e
comportamento público S13 continuam pendentes. Legado/flags reais preservados.

Boas-vindas: onda 114 de shared-api-host.md e onboarding-locadora.md. Consumidor
usa plataforma/RLS existentes, revalida dono, congela o envelope e registra
aceitação; retry incerto após 23 horas exige conciliação. 162 provas locais e
builds passaram, com envio simulado. Signup, scheduler real, legado e
fiscalização preservados; publicação avançou na onda 115, UI/homologação
pendentes.

Reativação: onda 110 de shared-api-host.md e entrada 291. Plano mensal
público/vendável cria outra assinatura sem teste; dono/vínculo/sessão recente e
recibo scoped protegem o pedido. Inativação/waiver da anterior e dependência
transitiva precedem emissão; UNKNOWN/404 só conciliam, pagamento antigo gera
auditoria. 480 casos e dez HTTP locais; UI/backoffice/Asaas real pendentes.
Hierarquia de upgrade/downgrade depende de decisão comercial, não de sortOrder.

Confirmação de activate: onda 109 de shared-api-host.md e entrada 290. Tela web
reutiliza owner-action/use-owner-action/SubscriptionActions, conserva pedido
incerto, relê após accepted e não presume pagamento. 180 focados e 18 Chromium
locais; mobile só estado/link, legado ativo. Troca/reativação/onboarding e
aceites jurídicos/comerciais/externos pendentes.

Ativação/emissão: onda 108 de shared-api-host.md, assinatura-plataforma.md e
entrada 289. Dois hosts reutilizam commands/owner; duas fases duráveis e UNKNOWN
apenas GET, com reserva/RLS/compensação. 515 provas locais e seis verificações
HTTP, sem provedor/produção/enforcement ou retirada do legado. Próximo:
confirmação web de activate, demais comandos/onboarding/backoffice.

Origem Zoho e catálogo público: onda 103 de shared-api-host.md, entrada 285 e
assinatura-plataforma.md. Origin explícito é verificado antes de mailbox/state;
GET /api/public/plans usa papel separado READ ONLY, DTO estrito e preços
cadastrados, sem fallback ou ofertas inventadas. 502 casos distintos passaram,
27 novos, incluindo 116 HTTP e a resolução das oito falhas de origem anteriores.
S6/UI/onboarding/backoffice e aceites externos parciais, legado ativo.

Comunicação/documentos: onda 101 de shared-api-host.md, limites-plano.md e
entrada 283. WhatsApp e assinatura digital revalidam módulos antes da intenção
durável; contrato local/envio ajustado revalidam acesso. Efeitos já aceitos não
repetem admissão. 437 provas distintas (46 novas); Zoho externo precisa de
aceitação/reconciliação própria, Merchant em quarentena. S8/site/equipe/SaaS e
aceites externos parciais; fiscalização off e legado ativo.

Orçamento/locação/perfil: onda 100 de shared-api-host.md, limites-plano.md e
entrada 282. Comandos manuais revalidam dentro da transação; conversão paga
aceita permanece no mesmo núcleo. Perfil próprio conserva SETUP/RESTRICTED,
ARCHIVED recusa. 760 casos distintos, 116 novos; S8/equipe/comunicação/site/SaaS
e aceites externos parciais, fiscalização off e legado ativo. Próximo
consumidor: comunicação/divulgação. Cota de equipe depende de serviço real de
convite/gestão.

Boleto manual e obrigações: onda 99 de shared-api-host.md, limites-plano.md e
entrada 281. requestQuoteBoletoPayment revalida cada preparação; ensure
permanece para jobs aceitos no mesmo núcleo. Retorno/fechamento, baixa e
reemissão revalidam na transação. 587 provas distintas, 80 novas; fiscalização
off e S8 parcial. Demais comandos/equipe/site/SaaS/aceites externos pendentes,
legado ativo.

Admissão da assinatura: onda 97 de shared-api-host.md, limites-plano.md e
entrada 279 de known-issues. Principal HTTP usa acesso/dono atuais e módulos
depois de CSRF/vínculo. Helpers e 20 pares de adapters preservam requisição real
e recusas comerciais. Off/shadow mantêm compatibilidade. S8 ainda parcial:
revalidar comandos financeiros/módulos na transação, equipe, jobs e site antes
de ativar fiscalização. Geral ~60% continua estimativa de esforço.

Cota de equipamentos: onda 96 de shared-api-host.md, limites-plano.md e entrada
278 de known-issues. Admissão é compartilhada e transacional: modos
off/shadow/on, RLS, organização/cota, plano atual e exceções válidas. Shadow usa
savepoint; downgrade conserva registros. Primeiro corte S8, sem ligar
fiscalização ou certificar matriz geral, módulos, equipe, site ou obrigações
financeiras.

Avisos comerciais: onda 95 de shared-api-host.md e entrada 277 de known-issues.
subscriptions.notify/dunning/mail usam outbox/cron existentes, contatos da
plataforma e Resend configurado. Envelope/chave duráveis, revalidação e teto de
23h para retry incerto. Datas seguem o domínio atual, não outra máquina de
estados; S6/S8 continuam parciais. Não há envio real certificado ou cutover.

Eventos comerciais: onda 94 de shared-api-host.md e entrada 276 de known-issues.
SUBSCRIPTION persiste handoff; PROCESSED não confirma fatos financeiros. Jobs
revalidam recibo/ID após leitura; UNKNOWN cancelado recupera vínculo sem POST.
UNROUTED só é recuperado com sourceEnvironment comprovado e imutável; null
histórico não é presumido. S6 parcial, legado/scheduler ativos.

Reconciliação comercial: onda 93 de shared-api-host.md e entrada 275 de
known-issues. Jobs por portas no cron existente; invoice.ts comum ao webhook;
UNKNOWN por referência sem POST; PUT INACTIVE e intenção durável antes de DELETE
elegível. 404 não confirma efeito; Retry-After também adia a outbox. S6 parcial:
emissão, notificações/régua e saúde diária faltam (SUBSCRIPTION entrou na onda
94). Legado/scheduler/produção preservados.

Faturas comerciais: onda 92 de shared-api-host.md, assinatura-plataforma.md e
entrada 274 de known-issues. PAYMENT da raiz usa subscriptions.invoice.webhook;
fatos atuais, dinheiro, histórico e projeção transacional. Sem configuração
explícita da raiz, job permanece PENDING. SUBSCRIPTION, emissão, reconciliação
periódica e consumidores notify/provider-deactivate continuam pendentes; S6 é
parcial. API legada/scheduler preservados.

Saúde Asaas: onda 91 de `shared-api-host.md`, `conta-recebimentos.md` e entrada
273 de known-issues. `payment-accounts.webhook` já tem consumidor compartilhado;
reconsulta fatos com chave da locadora e preserva bloqueio, conflito e rotação.
Só metadados de chave via secrets. PAYMENT comercial ganhou consumidor na onda
92; SUBSCRIPTION continua pendente para S6. S9 é parcial e não certifica
operação real.

Registro histórico da entrada Asaas na onda 90 de shared-api-host.md e entrada
272 de known-issues, anterior à retirada da antiga `app/` no clone F. Endpoints
novos /api/webhooks/asaas/platform e /[integrationId] existem nos dois hosts;
persistência após autenticação, filas por responsabilidade, token estrito e
alertas de conflito/UNROUTED. Tópico platform.webhook.process permanece PENDING
para S6; conta/chave usam o consumidor próprio desde a onda 91. URLs antigas não
foram trocadas; S5 ainda era parcial. Esse checkpoint não autorizava retirar a
raiz nem configurar provedores.

Cofre e credenciais: ondas 87–89 de `docs/features/shared-api-host.md`,
B.7.3/S3/S7 de `docs/architecture/adr-saas-subscription.md` e entradas 269–271
de known-issues. Criptografia/lifecycle no módulo secrets; runtime injeta
env/KMS, preserva ENV_REF e não faz fallback de VAULT. Importação assistida de
uma integração por plano confirmado existe, incluindo userAgent cifrado de
MELHOR_ENVIO. HMAC tem um predecessor por até 24h. Bloqueio administrativo
persiste recibos e adia efeitos; suspensão comercial é outra projeção. S5/S8/S9,
migração real, AWS/OIDC/provedores e aceite operacional continuam pendentes. Não
trocar segredos reais ou retirar o legado.

Aceite operacional, retorno ao legado e critérios para retirar a raiz:
`docs/guides/shared-api-acceptance.md`, onda 59 de
`docs/features/shared-api-host.md`. A suíte local usa API_AUTH_MODE para
selecionar legacy/Better Auth; SSR e dublês não certificam aparelhos ou
provedores.

Extração da API compartilhada: `docs/architecture/adr-backend-extraction.md` e
`docs/features/shared-api-host.md`. A comparação histórica de `test:api` entre
serviço e as antigas fachadas `app/`/`lib/`, retiradas no clone F, usou
PostgreSQL RLS; a suíte portada exercita o host API/backend sem recriar a raiz.
O motor de autenticação legacy permanece no serviço ao lado de Better Auth. O
checkpoint da transferência de 2026-09-30 é histórico:
`docs/ai/claude-codex-handoff-2026-09-30.md`.

Perfil comercial do cliente: `docs/features/customer-profile.md`. Leitura
isolada em `ClientProfile`, sem fallback global; GET e PUT têm adapters nos dois
hosts. Vínculo explícito: `docs/features/tenant-client-enrollment.md`; POST já
composto no serviço parcial. Clientes ainda usam a origem legada configurada.

Motoristas: `docs/features/operations-tenancy.md`. GET/POST admin/drivers nos
dois hosts, com ADMIN da locadora atual, CSRF central e transação em
backend/operations. Schema de criação em contracts/drivers; a extração não
acrescenta papéis ou validações de negócio.

Categorias administrativas: `docs/features/admin-system.md` e o corte 28 de
`docs/features/shared-api-host.md`. GET/POST nos dois hosts, com EQUIPMENTS/READ
ou WRITE, CSRF central e transação em backend/catalog. Schema estrito de criação
em contracts/categories; normalização, unicidade e lock continuam no backend.
PUT/DELETE por id também estão no serviço (corte 29), com WRITE ou DELETE,
ownership antes do corpo e proteção de vínculo com equipamento.

Unidades físicas: `docs/features/admin-system.md` e os cortes 15/30 de
`docs/features/shared-api-host.md`. GETs e POST nos dois hosts, com permissão
granular e catálogo compartilhado. Schema de criação em
contracts/equipment-units; DTO, unicidade por locadora e medidores preservados.
PATCH/DELETE por id também compostos (corte 31), com WRITE/DELETE, posse antes
do corpo e recusa de exclusão em uso. Clientes ainda usam a origem legada.

Equipamentos administrativos: `docs/features/admin-system.md` e cortes
16/17/32/33 de `docs/features/shared-api-host.md`. GETs e POST estão no serviço;
criação delega a catalog/createEquipment, com WRITE, limitador anterior à
autorização, normalização e categoria da locadora. PUT/DELETE também compostos
na onda 33, preservando os casos de uso; erros inesperados do PUT genéricos em
produção. Veículos e logística: `docs/features/operations-tenancy.md`, factories
em backend/operations e schemas em contracts/operations. A cadência humana em
boot.md exige implementar a onda inteira antes de consolidar os testes.

Portal de locações e pedidos:
`docs/features/area-cliente-historico-detalhes.md`. Consultas de orçamentos:
`docs/features/quote-system.md`. A onda 34 monta nove operações nos dois hosts
sobre rentals/quotations, mantendo soft delete, ownership e pedidos duráveis;
schema estrito em contracts/rental-requests. Resultados consolidados em
`docs/features/shared-api-host.md`.

Ciclo administrativo de locações, checkout/checkin, multa e prorrogação:
`docs/features/admin-system.md`. Atividades e prorrogação direta do cliente:
`docs/features/area-cliente-historico-detalhes.md`. Listagem de orçamentos:
`docs/features/quote-system.md`. A onda 35 monta doze operações sobre o backend
existente; contracts/rentals compartilha somente os schemas. Prorrogação direta
e pedido de atendimento mantêm comportamentos distintos.

Caixa de notificações do cliente: `docs/features/notification-system.md`.
Listagem e estatísticas compartilhadas em communications, query da listagem em
contracts; marcação/exclusão e mark-all-read compartilhados. Sync e fan-out
continuam legados; clientes ainda usam a origem configurada do legado.

- List feature docs: `rg --files docs/features`
- Search for a feature keyword: `rg -n "keyword" docs/features`
- Search known issues: `rg -n "keyword" docs/issues/known-issues.md`

## If a Feature Doc Does Not Exist

1. Ask the user for expected behavior.
2. Create `docs/features/<feature>.md` using `docs/features/_template.md`.
3. Link it from `docs/features/INDEX.md`.

_Last updated: 2026-10-02_

Endereços por locadora: docs/features/customer-addresses.md.
GET/POST/PATCH/DELETE compartilhados em customers; o host HTTP usa o mesmo
serviço e contratos. Clientes ainda apontam ao legado; não confundir paridade
local com cutover.

Carrinho por locadora: docs/features/cart-pricing-sync.md, seção da API.
GET/POST sync e POST merge montados no serviço parcial, usando customers/cart;
preços, substituição/mesclagem, CLIENT, RLS e lock são os existentes. O cliente
do hook ainda envia `items` a merge, enquanto o contrato exige `localCartItems`:
dívida preservada nesta extração estrutural, sem cutover.

Perfil comercial por locadora: docs/features/customer-profile.md. GET/PUT
montados no serviço parcial com customers/profile e schema estrito em
contracts/customer-profile. A mesma validação atende o legado; normalização,
RLS, ownership, unicidade e DTO permanecem no backend. Sem cutover dos clientes.

Mutações de orçamento e criação pública: docs/features/quote-system.md. Onda 36
monta nove métodos em apps/services/api sobre quotations/rentals e contratos
existentes comuns. Evidências consolidadas e rechecagens focadas na onda 36 de
docs/features/shared-api-host.md. Documentos, emissão externa, callbacks e jobs
continuam legados; não remover app nem trocar a origem dos clientes.

Documentos de orçamento/ofício: docs/features/quote-documents.md e onda 37 de
shared-api-host.md. Cinco GETs nos dois hosts; queries/branding/mapper/renderers
em backend e tokens impressos canônicos. Legado ativo; consultas financeiras são
o próximo bloco, separado de emissão externa/jobs.

Leituras financeiras: docs/features/admin-financeiro-page.md e onda 38 de
shared-api-host.md. Seis GETs nos dois hosts, consultas em billing e geradores
em documents; tokens de calendário/impressão canônicos. Entrada 238 documenta
agregados parcialmente nulos e CSV com prefixo de fórmula preservados, pendentes
de correção explícita.

Mutações financeiras: onda 39 de docs/features/shared-api-host.md e
docs/features/modernization-billing.md. Quatro métodos nos dois hosts sobre
backend/billing, schemas em contracts/financial. Confirmação e pedido/worker de
reemissão únicos; somente o pedido é montado no serviço. Serviço parcial 68/94;
99 métodos restantes, API legada e jobs ativos, sem cutover de clientes.

Pedidos de cobrança e documento do provedor: onda 40 de shared-api-host.md,
modernization-billing.md e issues/modernization-billing-recovery.md. PIX,
geração/regeneração de boleto, geração administrativa e PDF nos dois hosts;
factories em backend/billing, credenciais env em backend/runtime e schema em
contracts/payments. Serviço parcial 73/99 e 94 métodos restantes. Emissão e
reconciliação têm implementação compartilhada, mas seguem executadas pelos jobs
legados; callbacks/webhooks não migrados, nenhuma origem alterada.

Verificação e webhooks de pagamento: onda 41 de shared-api-host.md,
modernization-billing.md e issues/modernization-billing-recovery.md. Factories
em backend/identity/tenant-webhook, identity/webhook-auth, outbox/webhook-inbox
e billing/{pix-webhook,boleto-webhook,boleto-verification}. Adapters no serviço
e fachadas no legado; schemas em contracts/payments. Serviço parcial 78/104 e 89
métodos restantes. Worker compartilhado, scheduler apenas legado. Recepção HTTP
local provada nos dois motores; Asaas real e cutover operacional não
certificados.

Contratos e callback ZapSign: docs/features/contracts.md e onda 42 de
shared-api-host.md. Geração/leitura/pedido/renderer/consumidor em
backend/documents, download em backend/http, storage lazy em backend/runtime e
schemas em contracts/rental-contracts. Sete métodos nos dois hosts; serviço
84/111, legado 149/193 ativo e 82 métodos restantes. Efeitos de assinatura,
reconciliação e arquivo, adapter ZapSign e scheduler ainda legados. Próximo
corte: esses efeitos compartilháveis, depois uploads/documentos, mantendo um
único scheduler e a origem atual até paridade operacional. SQL/RLS e HTTP local
provados nos dois motores; ZapSign/Supabase reais não certificados.

Assinatura/arquivo e documentos operacionais: docs/features/contracts.md,
client-documents-antifraud.md e onda 43 de shared-api-host.md. Efeitos e adapter
ZapSign agora em backend/documents, upload em backend/http, enum em contracts;
listagem customers existente. Fachadas legadas mantidas, scheduler único no
legado, reconciliação UNKNOWN sem consumidor. Serviço 86/113, legado 149/193
ativo e 80 métodos restantes. Dois métodos novos com HTTP/SQL/RLS local nos dois
motores; storage/provedor reais e cutover não certificados. Próximo bloco:
upload público de imagens e endpoints administrativos correlatos, mantendo
credenciais e política atuais, sem assumir migração operacional.

Imagens/settings administrativos: docs/features/admin-system.md e onda 44 de
shared-api-host.md. Catalog valida/transforma imagens e trata settings; http
controla quota/upload, runtime compõe storage e contracts/settings unifica
schemas. Upload exige ADMIN, settings usa READ/WRITE granular. Serviço 88/116,
legado 149/193, 77 métodos restantes. Cache entre hosts depende de migração
operacional. Próximo bloco: comunicações/contadores administrativos e
integrações, mantendo scheduler único. Mobile sem inclusão de tipos do backend:
entrada 239.

Perfil e gestão de endereços dos consumidores: onda 63 de shared-api-host.md,
docs/features/customer-profile.md e docs/features/customer-addresses.md. A
entidade cliente reúne transporte privado com o orçamento; shared/api contém
somente o ciclo opaco de cancelamento. Páginas reiniciam por locadora/usuário.
Provas de renderização e HTTP/RLS aprovadas nos dois hosts/motores, sem
cutover/retirada; visão geral/histórico, aparelhos, paridade nativa e SaaS ainda
pendentes.

Visão geral/histórico dos consumidores: onda 64 de shared-api-host.md e
area-cliente-historico-detalhes.md. Transportes em
packages/frontend/src/entities/locacao/api/client-rentals.ts,
packages/frontend/src/entities/orcamento/api/client-quotes.ts e
packages/frontend/src/entities/cliente/api/customer-api.ts. Escopo/cancelamento
em shared/api; polling/filtros/totais/soft delete conservados. Próximo: detalhe,
ações e documentos/pagamentos, depois telas nativas e SaaS. Legado e agenda
ativos; não concluir retirada da raiz por inventário ou bundles.

Detalhe/pedidos/download do histórico: onda 65 de shared-api-host.md,
area-cliente-historico-detalhes.md e contracts.md. Transportes e DTOs nas
entidades locação/orçamento; binary opcional em shared/api consome o corpo antes
de checar escopo. Chaves por locadora/usuário/registro; extensão direta e pedido
à equipe continuam diferentes. Portal/Trigger das ações corrigidos. Provas
renderizadas, cookies/RLS e HTML/PDF locais nos dois hosts/motores aprovados.
Próximo: pagamentos/documentos, aparelhos, SaaS e operação; legado/agenda
ativos.

Pagamentos/documentos administrativos: onda 66 de shared-api-host.md,
modernization-billing.md, admin-financeiro-page.md, admin-orcamentos-page.md,
quote-documents.md e client-documents-antifraud.md. Boleto na entidade
pagamento; adapters exclusivos nos segmentos api das páginas locacoes,
financeiro e orcamentos-admin. 202/multipart/PDFs preservados, escopo descarta
efeitos antigos. Outros consumidores administrativos, nativo/SaaS/operação
pendentes naquele incremento; a antiga `app/` só foi retirada depois no clone F,
com provas próprias, não pela contagem de rotas da onda 66.

Financeiro/orçamentos administrativos: onda 67 de shared-api-host.md,
admin-financeiro-page.md e admin-orcamentos-page.md. Adapters nas páginas donas
usam transporte configurado; filtros, payloads, 202/409 e históricos
preservados. 82 casos focados e seis HTTP por motor locais aprovados. Próximo:
locações administrativas; demais consumidores, aparelho/SaaS/operação ainda
pendentes.

Catálogo administrativo conectado: onda 68 de shared-api-host.md e
admin-system.md. Categorias/equipamentos/unidades usam adapters exclusivos e
transporte configurado; texto não JSON da edição/statusText preservado. 43 casos
focados e três HTTP por motor locais aprovados. Locações já estava conectada na
onda 66; próximo: medidores textuais no renderizador e consumidores de
dashboard/manutenção/logística. Comunicações, nativo/SaaS/operação e retirada
segura da raiz permanecem pendentes; geral ~60% é estimativa de esforço.

Operações administrativas conectadas: onda 69 de shared-api-host.md,
operations-tenancy.md e admin-system.md. Dashboard/manutenção/logística usam
adapters nas páginas donas e transporte configurado; medidores textuais
corrigidos na apresentação. 54 casos focados únicos, tipos/gates/builds
aprovados. Próximo: comunicações/configuração, depois nativo/SaaS/operação.
Legado ativo; progresso geral ~60% é estimativa de esforço.

Comunicações/configuração/permissões conectadas: onda 70 de shared-api-host.md,
admin-system.md e docs de Zoho/WhatsApp/permissões. HttpClient cobre JSON/texto/
multipart/binário, preservando OAuth pelo web. Ciclos/rascunhos/bulk protegidos;
49 casos únicos, tipos/gates/builds aprovados localmente. Próximo: consumidores
residuais/paridade nativa, SaaS e aceite operacional. Legado ativo; ~60% geral
continua estimativa de esforço.

Entradas pós-login Expo: onda 71 de shared-api-host.md, admin-system.md e
area-cliente-historico-detalhes.md. Dashboard/visão geral usam variantes nativas
das slices e modelos/transporte compartilhados; callbacks de saída no host. 58
casos focados e tipos/gates/builds/source maps aprovados. Destinos mobile
ausentes e fidelidade em aparelho continuam pendentes; próximo orçamento/
catálogo e histórico nativos, depois SaaS/operação. Legado e agenda ativos; ~60%
geral era estimativa de esforço; a onda 71 não autorizava retirar a antiga
`app/`, posteriormente retirada no clone F.

Histórico/detalhes Expo: onda 72 de shared-api-host.md e
area-cliente-historico-detalhes.md. Modelos/preços/timeline compartilhados;
atividade via AppState e contratos via cache/compartilhamento do host. Provas
locais/bundles aprovados, aparelho/recebimento pendentes. Próximo:
orçamento/detalhe de catálogo nativos, depois SaaS/operação; legado/agenda
ativos; geral ~60% estimativa de esforço.

Detalhe público web/Expo: docs/features/equipment-detail.md e onda 73 de
shared-api-host.md. Modelos de preços/datas/confirmação comuns, parser único e
rota nativa fina. Orçamento Expo continua pendente; não declarar fluxo de
solicitação completo naquela onda nem retirar a antiga `app/` por esse
incremento; a retirada posterior no clone F tem validação independente.

Orçamento Expo: onda 74 de shared-api-host.md e quote-system.md. Página e
formulário compartilham modelos/transportes com o web; preferências assíncronas
isoladas por locadora/usuário. Host só integra imagem/parametrização/storage.
Detalhe público alinhado no proxy. Provas locais/tipos/gates/bundles aprovados,
aparelho/frete/seleção interativa de endereço pendentes. Próximo: perfil,
endereços e notificações nativos, depois admin/SaaS/operação. Legado ativo; ~60%
geral continua estimativa de esforço.

Perfil/endereços/notificações Expo: onda 75 de shared-api-host.md e
customer-profile.md, customer-addresses.md, notification-system.md. Modelos
universais/transporte configurado; contador DOM apenas web, CEP e respostas
antigas descartados por ciclo. Rotas finas e exports locais aprovados;
aparelhos, destinos administrativos, SaaS e aceite operacional pendentes.
Legado/agenda ativos; geral ~60% continua estimativa de esforço.

Catálogo administrativo Expo: onda 76 de shared-api-host.md e admin-system.md.
Lista/detalhe/unidades compartilham modelos e contratos; hosts só roteiam e
integram imagem. Confirmações/respostas antigas descartadas por ciclo. Builds e
gates aprovados; criação/edição/categorias nativas, aparelho/SaaS/operação
pendentes. Legado e scheduler ativos; ~60% geral continua estimativa de esforço.

Formulários de equipamento Expo: onda 77 de docs/features/shared-api-host.md e
docs/features/equipment-parts-loss.md. Cadastro/edição, preços/especificações/
estoque e perdas compartilham modelos com web; picker pertence ao host e upload
usa transporte configurado. Scope/revisão descartam seleção/continuação antiga;
fotos de perdas separadas do array público. Categorias/aparelhos/SaaS/operação
seguem pendentes; legado ativo.

Categorias administrativas Expo: onda 78 de docs/features/shared-api-host.md,
entrada 261 de issues. CRUD/editor usam modelos comuns; seleção/leitura SVG só
no host, Bloco.native reutilizado e ciclos descartam respostas/seleções antigas.
Demais destinos/admin, aparelho, SaaS/operação pendentes; legado ativo, ~60%
estimativa de esforço.

Locações administrativas Expo: onda 79 de shared-api-host.md, entrada 262.
Modelo/API comuns, lista/filtros/página dez, detalhe/contrato/check-in/out e
documentos com picker de host. Sessão/revisão/registro capturados; seleção
antiga não envia. Agenda funcional diária/semanal/mensal; grade visual web,
aparelho/documentos reais, demais admins/SaaS/operação pendentes. Legado ativo;
~60% geral continua estimativa de esforço.

Orçamentos administrativos Expo: onda 80 de shared-api-host.md, entrada 263.
Modelos de lista/detalhe comuns; facades web preservam Next/RAF/badges e hosts
Expo só parâmetros/URLs/compartilhamento. 202/409, reajustes parciais e ciclos
preservados. Agenda/pipeline/datas AAAA-MM-DD funcionais, aparelho/visual/SaaS/
operação pendentes. Próximo consumidor: financeiro; legado ativo, ~60%
estimativa.

Financeiro administrativo Expo: onda 81 de shared-api-host.md, entrada 264.
Modelos de carga/detalhe e DTO de calendário puros; facades web isolam Next/DOM,
host Expo só parâmetros/Alert/navegação/bytes. 202/negativas/recusa parcial e
escopo preservados. Próximo bloco: logística/manutenção; aparelho/visual/SaaS/
operação pendentes e legado ativo. ~60% geral continua estimativa de esforço.

Operações Expo: onda 82 de shared-api-host.md, operations-tenancy.md e entrada
265 de issues. Contratos/checklist/calendário comuns, ícones web isolados,
picker/imagem no host e upload autenticado com escopo. Native monta logística/
manutenção; criação segue pendente como no web, grade/Gantt/gestos/aparelho não
certificados. Próximo: configurações/permissões/comunicações; legado ativo.

Configurações/permissões Expo: onda 83 de shared-api-host.md, admin-system.md e
entrada 266. Modelo de settings comum, fachada web para DOM/mensagens e picker/
imagem no host Expo; upload autenticado descarta seleção antiga por revisão.
Permissões nativas existentes caracterizadas, wrappers por status, atalhos reais
de dashboard. Previews/aparelhos/fidelidade pendentes. Próximo: comunicações;
legado/scheduler ativos, geral ~60% estimativa.

Comunicações Expo: onda 84 de shared-api-host.md e entrada 267 de issues.
email-admin/whatsapp-admin compartilham modelos/API; host só arquivos/UUID/
storage/HTML isolado e conexão Zoho pelo painel web autenticado. JSX web
preservado. Aparelhos/visual/gestos/provedores e OAuth real não certificados.
Próximo: lotes SaaS restantes e aceite operacional, mantendo legado/scheduler.

SaaS — dados e papéis S2: onda 85 de docs/features/shared-api-host.md e
docs/features/assinatura-plataforma.md. Dezessete modelos PLATFORM, sete
migrations e SQL DBA fora das migrations; separar TENANT_RUNTIME_DATABASE_URL e
PLATFORM_RUNTIME_DATABASE_URL no check. Não trocar runtime/ambiente antes do
aceite. Pool/transação/outbox/cron S2 ainda pendentes.

## Onda 98 — admissão transacional

Logística/manutenção e PIX/boleto revalidam na transação. Direitos/obrigações
comuns ao gate HTTP; jobs aceitos separados. Provas/pendências: onda 98 de
shared-api-host.md, limites-plano.md e entrada 280. Fiscalização real off,
legado ativo; ~60% geral continua estimativa de esforço.

## Onda 102 — Zoho externo

Admissão durável e fronteira do provedor:
docs/architecture/zoho-command-admission.md, onda 102 de shared-api-host.md e
entrada 284. Fiscalização real off e legado ativo. Reconciliação/equipe/site/UI
SaaS/aceites reais continuam pendentes; geral ~60% permanece estimativa de
esforço.

## Onda 104 — consultas da assinatura

Leitura do dono e faturas: assinatura-plataforma.md e onda 104 de
shared-api-host.md. OwnerUserId/vínculo ADMIN são revalidados em READ ONLY/RLS;
leitura exata do dono em SETUP/RESTRICTED/ARCHIVED, sem abrir escritas.
Legado/scheduler ativos, fiscalização off; UI SaaS, ações e operação externa
continuam parciais.

## Onda 105 — consulta da assinatura nos clientes

Tela compartilhada /admin/assinatura: web consulta plano/uso/faturas; Expo só
estado e navegador, conforme a ADR. Não inferir propriedade de ADMIN nem
transportar credenciais para o painel. Modelo descarta dados ao mudar usuário,
vínculo, locadora ou transporte. Ver assinatura-plataforma.md e onda 105 de
shared-api-host.md. Builds/exports/16 Chromium aprovados; dashboard sem diff.
Paridade global Tailwind tem 12 classes anteriores sem fixture (entrada 287),
sem relaxar baseline. Próximo: resolver essa referência e ação do dono sobre
serviço compartilhado. Legado ativo/fiscalização off, SaaS e operação parciais;
~60% geral continua estimativa de esforço.

## Onda 106 — comandos do dono

Cancelamento/desfazimento: assinatura-plataforma.md e onda 106 de
shared-api-host.md. Lógica em modules/subscriptions/owner-cancellation.ts; HTTP
em http/owner-cancellation.ts; compositor único em runtime/platform-jobs.ts.
Sessão fresca usa sign-in NextAuth/createdAt Better Auth, nunca renovação.
Recibos scoped e row locks protegem replay/troca de dono/ciclo pago. UI de
confirmação ainda pendente, mobile continua estado/link; legado ativo,
enforcement off, ~60% geral estimado. Referência de CSS 287 continua aberta.

## Onda 107 — confirmação no web

pages/assinatura-admin compõe cancel/undo-cancel sem regra comercial na UI:
confirmação, retry manual scoped e releitura após recibo. Login existente tem
requireReauthentication/reauthenticate=1 para não pular o formulário por cookie
antigo; flag não substitui autenticação recente do backend. Mobile segue
estado/link. Provas e limites: onda 107 de shared-api-host.md; legado ativo,
enforcement off, ativação/troca/onboarding/backoffice e operação ainda parciais.

## Onda 111 — reativação na tela do dono

pages/assinatura-admin: catálogo estrito em api/reactivation-offers.ts, ciclo
scoped em model/use-reactivation-offers.ts e escolha em
ui/ReactivationPlans.web.tsx. owner-action/use-owner-action/SubscriptionActions
compõem a confirmação e repetição manual com a mesma versão/chave. Backend
continua na onda 110; mobile mantém estado/link. Provas: onda 111 de
shared-api-host.md e assinatura-plataforma.md. Troca de plano aguarda critério
comercial; próximo independente é onboarding/provisionamento. Legado ativo,
enforcement off, aceites externos/Tailwind 287 continuam parciais.

## Onda 112 — cadastro assistido

S10 parcial em packages/backend/src/modules/onboarding. Caso atômico, recibo
HMAC, trial canônico, limites persistidos e sementes neutras; CLI
tools/platform-provision-tenant.mjs. A composição fica somente em
runtime/platform-jobs; runtime/onboarding só lê o manifesto jurídico externo.
PLATFORM_LEGAL_DOCUMENTS_FILE contém metadados de textos aprovados/publicados,
nunca uma publicação vinda do corpo. Prévia sem --apply não abre conexão. 196
provas distintas, tipos/gates/builds API/legado locais. Sem rotas públicas,
UI/status/publicação ou consumidor welcome nesta onda; esses são os próximos
cortes. Ver onboarding-locadora.md, onda 112 de shared-api-host.md e refinamento
S10 do ADR. Legado/enforcement off e critério comercial pendente preservados.

## Onda 113 — adaptadores e checklist de onboarding

Na onda 113 havia três rotas paralelas na antiga `app/api/onboarding`, retirada
no clone F, e em `apps/services/api/src/app/api/onboarding`; consumiam
http/onboarding, http/onboarding-status e modules/onboarding/status.
runtime/platform-jobs compõe criação, sem segunda conexão de plataforma. Sessão
de conta protege criação/disponibilidade; status revalida dono na transação
restrita da locadora. runtime/onboarding-captcha confere ação/host no Siteverify
somente em pedidos novos; recibo confirmado continua replayable. Cadastro
público off, leitura assistida disponível. 234 provas locais;
UI/publicação/welcome, AWS/Cloudflare reais e operação pendentes. Ver
onboarding-locadora.md e onda 113 de shared-api-host.md. Legado/enforcement e
decisão comercial preservados.

## Onda 116 — dashboard e checklist do dono

Entidade onboarding lê o contrato privado; publicar-site confirma no web;
checklist-primeiros-passos compõe no dashboard web/Expo. Native abre o painel
configurado pelo host. Scope invalida leitura/intenção; etapa só muda por
releitura. GET/HEAD direto de aparelho conserva dono/RLS; metadados de navegador
ou borda exigem contexto app genuíno. Uma exceção de tipo saiu por consumo real.
273 casos e 30 verificações Chrome com fixtures, tipos/gates/builds/ bundles
locais passaram. Ver onboarding-locadora.md e onda 116 de shared-api-host.md.
Wizard, recebimentos, S13/operação, parceiros/aparelhos e retirada do legado
continuam pendentes; flags e decisão comercial preservadas.

## Onda 117 — opções aprovadas antes do cadastro

GET /api/onboarding/options nos dois hosts delega ao backend comum. Contexto app
genuíno, texto UTF-8 exato conferido pelo hash aprovado, chave pública de
captcha, cache privado e resposta off sem leitura de arquivos. Configuração nova
externa: PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE. Não publica segredo nem cria
conta.

235 casos locais, tipos/gates/builds API e legado e 90 verificações HTTP
passaram; textos/on sintéticos não homologam jurídico, captcha ou login.
Servidores próprios encerrados; flags reais off, legado/proxy/scheduler ativos.
S11a /comecar continua pendente. Próximo corte: conta mínima e e-mail
verificado, plano e aceites aprovados no assistente web. Expo permanece somente
estado/link. Ver onda 117 de shared-api-host.md e onboarding-locadora.md; ~60%
geral é estimativa de esforço.

### Conta mínima e verificação — onda 118

Dois hosts montam owner-register, owner-account e owner-verification sobre
runtime/owner-account e o mesmo motor/pool/limitadores. Contratos ficam em
contracts/credentials. Contexto interno permite somente nome/e-mail/senha do
dono, sem alterar o cadastro de clientes; não cria locadora ou vínculo. Origem
app, publicação, captcha/senha comprometida e limites precedem efeitos.
Confirmação é fato do banco; reenvio só para a conta autenticada e limitado.

298 casos passaram, quatro skips antigos não certificados; token real foi
reenviado e consumido no banco descartável com e-mail simulado. Tipos/gates,
dois builds e 84 verificações HTTP off passaram; inventário 167/211 por host.
Processos próprios encerrados. Flags reais e legado preservados. Próximo:
/comecar web com plano/textos aprovados/criação explícita; Expo estado/link.
Recebimentos/S13/backoffice/provedores/operação e Tailwind 287 pendentes; geral
~60% é estimativa de esforço. Ver onda 118 de shared-api-host.md e
onboarding-locadora.md.
