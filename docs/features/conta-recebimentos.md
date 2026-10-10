# Conta de recebimentos

> **Status**: Critical **Last updated**: 2026-10-07

---

## 1. Purpose

### Onda 134 — criação da conta de recebimentos (2026-10-07, sem commit)

Parte A: contrato, tabela de pedido, caso de uso do dono e worker de criação.
Parte B: rotas nos dois hosts, composição nos crons, saúde da subconta, barreira
de emissão, tela e runbook. Tudo atrás de `PLATFORM_SUBACCOUNT_CREATION`,
desligada por padrão (ausente vale `off`); nenhum ambiente real foi ligado.

O dono declara o **faturamento mensal exato** (decisão de 2026-10-06), um
**celular** e confirma os dados da empresa exibidos. O contrato
(`CreatePaymentAccountInputSchema`) aceita só reais com centavos exatos em
string (`"98765.43"`; nunca `number`, sem mínimo nem teto, que seriam limites de
negócio) e só celular (DDD + 9 + 8 dígitos), e exige a versão (SHA-256) dos
dados que o dono viu. A faixa (`INCOME_RANGES`, `incomeRange`) saiu do contrato
e do esquema.

**Oferta e pedido** (`payment-accounts/owner-create.ts`, sem chamada ao
provedor): a oferta roda numa transação READ ONLY real e devolve um bloqueio,
nesta ordem: criação indisponível, conta existente, assinatura restrita ou plano
sem pagamentos on-line (com fiscalização `on`; decisão D-4), primeira
mensalidade não paga (`requiresPaid`), e-mail não verificado, aviso do parceiro
não aceito, dados da empresa incompletos e CNPJ em uso por outra locadora. O
pedido revalida tudo sob o lock da organização, com sessão recente, e grava numa
transação só a integração, a conta (`PROVISIONING`), o pedido, a auditoria e a
entrega `pa:create:<conta>:<instante>`. Um pedido idêntico é replay sem efeito;
outro valor é 409. Uma integração desligada sem segredo e sem referência do
provedor (sobra de pedido cancelado) não bloqueia criar nem conectar; integração
legada ou com segredo continua bloqueando.

**Worker `payment-accounts.provisioning`**
(`payment-accounts/subaccount-provisioning.ts`): busca por CNPJ antes de criar;
grava a intenção sob lock do CNPJ (`UNKNOWN`, hash do token do webhook embutido
e inspeção já na fila) antes do único POST; sela a chave devolvida no cofre como
primeira operação depois da resposta, com três novas tentativas que conferem a
impressão digital antes de regravar; se falharem, `KEY_RECOVERY_REQUIRED` sem
segredo. Resultado incerto (timeout, rede, 5xx, 2xx ilegível) nunca repete o
POST e fica com a inspeção GET-only da onda 129. Desfechos:

- recusa definitiva sem conta criada (400/403/422): o pedido é cancelado e
  devolvido ao dono; a oferta mostra só a categoria (`REJECTED_DATA`,
  `REJECTED_PROVIDER`) e os códigos do provedor ficam na auditoria (D-3);
- não enviado (interruptor, egress, 429, credencial ou configuração): volta a
  `PROVISIONING` com os mesmos dados, nova entrega com chave nova;
- chave raiz recusada (401/404, qualquer 4xx na busca, inclusive na inspeção):
  espera 1 h com auditoria de plataforma, sem bloqueio nem purga;
- dono trocado, empresa arquivada, dados alterados ou outro modelo antes do
  POST: cancelado sem chamada; troca de dono, arquivamento ou bloqueio
  administrativo durante a busca por CNPJ: a intenção confere o `updatedAt` da
  conta, da integração e da organização, libera o pedido sem POST e o próximo
  claim decide; troca de dono ou arquivamento durante o POST: chave selada e
  `BLOCKED` para revisão;
- pedido sem faturamento e celular fora do fluxo (purga manual): `BLOCKED`
  `PROVISIONING_REQUEST_MISSING`, sem POST; chave ativa recuperada à mão durante
  o POST: a chave emitida fica guardada como evidência, sem substituir a ativa,
  e a conta vai para revisão (`SUBACCOUNT_KEY_CONFLICT`);
- duas locadoras com o mesmo CNPJ: a primeira intenção vence, a outra é
  devolvida com `DOCUMENT_IN_USE`, um único POST.

**Faturamento e celular** ficam em `payment_account_provisioning_requests`
(migration 202610060101: FORCE RLS, só plataforma, sem SELECT do papel de
negócio, sem DELETE, trigger que só permite a purga) e são apagados em todo
desfecho sem POST possível (D-2); a manutenção
`provisioning-requests-maintenance.ts`, só de banco, é a rede de segurança e,
com a criação desligada ou outro modelo, devolve ao dono os pedidos nunca
enviados. Nunca vão para fila, auditoria, `lastErrorCode` ou resposta.

**Rotas e composição (parte B).** `GET` e
`POST /api/admin/payment-account/create` coexistiam nos dois adapters da parte B
(`app/api` da raiz antiga, retirada em F, e `apps/services/api`). Hoje o adapter
canônico é
`apps/services/api/src/app/api/admin/payment-account/create/route.ts`, com a
mesma composição: `handleConfiguredPaymentAccountCreation` em
`runtime/platform-jobs.ts`, oferta em transação READ ONLY e pedido no papel de
plataforma isolado, sem chamada ao provedor. `runtime/subaccount-creation.ts` lê
os interruptores uma vez para os dois hosts:

- `PLATFORM_SUBACCOUNT_CREATION`: só `on` liga; ausente ou `off` desliga; outro
  valor é inválido e também deixa a criação indisponível;
- `PLATFORM_ASAAS_SUBACCOUNT_MODEL`: só `STANDARD` habilita (BAAS espera o lote
  de documentos);
- ambiente, chave raiz, `PLATFORM_WEBHOOK_ORIGIN`, `PLATFORM_OPS_EMAIL`, cofre e
  a configuração de hosts (site da locadora) são obrigatórios;
- `PLATFORM_SUBACCOUNT_REQUIRES_PAID`: ausente vale `true`; só o literal `false`
  desliga.

Sem tudo isso, a oferta mostra `CREATION_UNAVAILABLE`, o POST devolve 409
`PAYMENT_ACCOUNT_CREATION_UNAVAILABLE` e o worker não é instalado. A manutenção
dos pedidos roda sempre, nos dois crons: com a criação desligada (ou outro
modelo) devolve ao dono os pedidos que nunca chegaram ao provedor; com a criação
ligada e configuração incompleta (ou valor inválido do interruptor) não cancela
nada. Em SETUP, o gate da assinatura admite ler a oferta e pedir a conta (ADR
B.5, "recebimentos"); em RESTRICTED o pedido continua 402 e em ARCHIVED, 403.

**Saúde da subconta (parte B).** `payment-accounts.health` passa a aceitar
subconta fora de `PROVISIONING`, `UNKNOWN`, `KEY_RECOVERY_REQUIRED`, `BLOCKED` e
`DISCONNECTED`. A entrega enfileirada pela selagem 15 s depois é processada:
identidade com a chave da própria subconta, PUT do webhook embutido com o token
recuperável (o token aleatório da criação segue aceito por 24 h) e projeção dos
quatro estados. A integração da subconta só fica `ACTIVE` na primeira projeção
`APPROVED` e nunca é rebaixada pela saúde; a conta conectada mantém a regra
anterior. A primeira aprovação completa (subconta ou conta conectada) verifica o
CNPJ: grava `documentVerifiedAt` junto com `documentNormalized`, que o cadastro
legado não tinha (o banco exige os dois juntos). Se outra locadora já verificou
o mesmo CNPJ, este fica sem verificar, a confirmação segue normalmente e a
auditoria de plataforma `payment-account.document.in-use` (`DOCUMENT_IN_USE`)
marca o caso para revisão, uma vez só, na primeira aprovação (posse do CNPJ da
ADR). As outras tentativas não verificadas com o mesmo CNPJ, que já existem
quando uma locadora é verificada, não recebem auditoria da saúde: a revisão
delas é do backoffice (S12). Colunas de CNPJ que discordam entre si ou do
provedor dão `ACCOUNT_DOCUMENT_MISMATCH`, sem gravar nem verificar CNPJ; CNPJ
trocado durante a configuração dá `COMPANY_DATA_CHANGED` sob o lock, sem gravar
o valor antigo. Uma falha depois de a nova leitura confirmar o webhook criado
(por exemplo, duas locadoras verificando o mesmo CNPJ no mesmo instante: a
segunda recebe o índice único) grava o código da própria falha, não
`WEBHOOK_CREATE_UNKNOWN`; a nova tentativa, 5 min depois, acha o webhook, faz
PUT e vai para revisão. Fila interrompida em subconta fica `RESTRICTED`, sem
reconciliação (que só existe para a conta conectada). O consumidor de eventos de
conta ignora, com recibo `IGNORED`/`ACCOUNT_PROVISIONING` e auditoria
`payment-account.webhook.ignored`, os eventos de subconta em criação; quando um
evento projeta `APPROVED` com a integração ainda `PROVISIONING`, grava
`nextAttemptAt` agora para a saúde confirmar e promover.

**Barreira de emissão (parte B).** `billing/receiving-account-readiness.ts`
recusa cobrança nova com 409 `PAYMENT_ACCOUNT_NOT_READY` enquanto a subconta não
está `APPROVED`, tem dados comerciais vencidos ou a integração não está
`ACTIVE`. Vale em `POST /api/payments/pix`, `POST /api/payments/boleto/generate`
e no boleto manual de orçamento (gerar e enviar), antes da escolha da
integração. Locadora sem conta de recebimentos (referência legada) e conta
conectada seguem como antes; estender a barreira à conta conectada é pendência.

**Tela (parte B).** Em /admin/recebimentos, sem conta atual e com a criação
disponível, o cartão "Criar conta de recebimentos" aparece antes da conexão de
conta própria (D-1). Ele mostra os dados que serão enviados (razão social, CNPJ,
endereço, e-mails e site), o faturamento mensal (campo de moeda do design
system; nada é enviado sem o dono digitar, e 0,00 só sai digitado), o celular
(sugerido quando o telefone cadastrado é celular) e a confirmação dos dados. O
valor fica só no componente: some ao cancelar, ao enviar, no `pagehide`, ao
trocar de locadora, sessão ou transporte e no unmount. Bloqueios e o desfecho do
pedido anterior aparecem em linguagem de leigo; resultado incerto só permite
consultar o estado. O aviso "Pedido recebido" vale enquanto a conta pedida
existe: quando a consulta seguinte não acha conta atual (pedido devolvido pela
instituição, D-3, ou cancelado), a página relê a oferta na mesma sessão e mostra
o motivo e um formulário vazio, sem recarregar. Com a criação indisponível, a
página é a de antes. Subconta `STANDARD` em `AWAITING_OWNER` ganha a orientação
de abrir o e-mail da instituição de pagamentos e enviar os documentos. O Expo
mantém estados e link.

Decisões do dono de 2026-10-07: D-1 (a) mostrar criar e conectar, D-2 (a), D-3
(a), D-4 (a); registro em B.18 da ADR. Provas com o dublê do Asaas e PostgreSQL
com os papéis canônicos, sem Asaas real; procedimentos em
[runbook da subconta](../operations/runbook-asaas-subaccount.md); resultados em
[API compartilhada](shared-api-host.md), onda 134.

### Onda 129 — inspeção de criação incerta (2026-10-05, sem commit)

O consumidor `payment-accounts.provisioning-recovery` usa o scheduler/outbox
existente nos dois hosts. Inspeciona somente subconta UNKNOWN com tentativa
durável, dono atual, ambiente e integração VAULT/PROVISIONING correspondentes,
sem chave ACTIVE. Nunca cria outra conta, recupera chave automaticamente ou
aprova recebimentos. Campos e contratos HTTP existentes permanecem iguais.

O adapter da conta raiz limita a busca por CNPJ a dois resultados e confirma o
resultado único por GET de id, CNPJ e carteira. Lista incompleta, múltipla ou
divergente é recusada. Ausência/falha transitória conserva UNKNOWN e agenda nova
consulta em cinco minutos; evidência inválida exige revisão em BLOCKED. Conta
confirmada sem chave vira KEY_RECOVERY_REQUIRED, com integração ainda
PROVISIONING e recibo auditado. Não há fallback para credencial de locadora.

Locks de organização, integração, conta e identidade de chave serializam o
trabalho. Leases e agenda vigentes são respeitados; dados são revalidados depois
do I/O. Mudança de dono/documento/chave, bloqueio ou worker posterior vence o
resultado tardio. Referências externas não podem ser atribuídas a outra conta.
Binding, estado e auditoria gravam juntos. Payload da fila contém apenas id
interno; consulta pública continua sem CNPJ, carteira ou chave.

O transporte de criação POST /accounts está preparado e testado, com valor
mensal Decimal explícito e um webhook embutido, usando o mesmo construtor da
configuração de eventos. A chave de resposta é encapsulada imediatamente e uma
resposta 2xx inválida é tratada como criação incerta. **Não há consumidor de
criação nem novo formulário/POST HTTP instalado neste bloco.** Faturamento
mensal declarado ou conversão de faixas depende da decisão do dono do produto; a
pergunta foi apresentada, sem escolher valores arbitrários. S9 permanece
parcial, assim como selagem/provisionamento completo e homologação BaaS.

Contrato de provedor verificado nas referências oficiais:
[criar subconta](https://docs.asaas.com/reference/criar-subconta),
[listar subcontas](https://docs.asaas.com/reference/listar-subcontas) e
[recuperar subconta](https://docs.asaas.com/reference/recuperar-uma-unica-subconta).
As provas usam transporte sintético, sem operação Asaas real. Resultados em
[API compartilhada](shared-api-host.md), onda 129.

Todo pagamento do cliente final cai direto na conta da locadora, no CNPJ dela,
sem split e sem porcentagem da plataforma. Esta página descreve o contrato da
"conta de recebimentos", definido pelo ADR
`docs/architecture/adr-saas-subscription.md` (B.7, D9, D10, D12 e D22).

O lote S0 entrega só o contrato em `@gb-locacoes/contracts/payment-account`. O
provisionamento, o cofre, os webhooks e as telas vêm nos lotes S3, S5, S7, S9,
S11b e S14.

Estado atual: S3/cofre, entrada durável e consumidor de saúde por evento
(onda 91) estão implementados localmente. A onda 120 entrega a consulta do dono
e a tela web; a onda 121 acrescenta a conexão inicial por POST. A onda 122
configura e inspeciona diariamente os eventos da conta conectada pelo scheduler
existente. A onda 123 inicia a recuperação financeira e a onda 124 liga o
formulário web ao POST existente, com prova local da interface. A onda 125
corrige o transporte da sonda: fetch substituía Host. A onda 126 comprova o
aceite 202 do dono pelo proxy, com motores reais, cofre e papéis de banco
isolados, usando provedor sintético local. Homologação externa, recuperação
final e BaaS continuam pendentes. S9 continua parcial. Subcontas, liberação de
filas interrompidas, documentos, confirmação anual, operações de chave e saque
seguem pendentes. A onda 127 acrescenta consulta privada do progresso e pedido
confirmado de nova conferência pelo dono. O mesmo job existente executa o
trabalho; nenhuma conclusão financeira libera comunicação ou pagamentos.
Fiscalização comercial tem cortes posteriores à onda 91 e permanece off no
ambiente real. Provas e limites em `shared-api-host.md`.

### Consulta entregue na onda 120

- Os dois hosts montam GET /api/admin/payment-account. HEAD/OPTIONS são os
  adapters automáticos do Next; não foi montada mutação neste caminho.
- A leitura usa o papel de negócio existente, sob RLS da locadora e snapshot
  RepeatableRead/READ ONLY. SELECT da conta é permitido quando o contexto está
  definido; leitura vazia sem contexto não significa exigir papel de plataforma.
  Nenhuma política ou grant mudou.
- Vínculo ADMIN ativo e dono atual são revalidados no mesmo snapshot. Nenhuma
  conta atual resulta em `{ account: null }`; falha não vira ausência. Browser
  exige borda genuína do app; dispositivo autenticado usa o mesmo núcleo. Query
  de seleção é recusada. Respostas têm private/no-store e Vary Cookie, Host,
  incluindo recusa inicial.
- A projeção não seleciona chave, walletId, providerAccountId, credentialsRef,
  renda ou dados bancários. Texto de situação usa mensagens conhecidas, sem eco
  de payload/erro do provedor. KEY_EXPIRED e KEY_DELETED agora são aceitos no
  contrato, pois já são fatos produzidos pelo consumidor.
- Aprovação com integração não ACTIVE, pendência de saúde ou confirmação anual
  vencida é apresentada como RESTRICTED. Isso não grava status e não certifica
  todas as formas de pagamento do produto.
- /admin/recebimentos vem de pages/recebimentos-admin e da entidade FSD
  conta-recebimentos. Menus web mostram o link após a consulta existente
  confirmar o dono. Checklist aponta para a consulta, sem botão que simule uma
  criação/conexão ausente. Trocas de identidade/locadora/transporte limpam o
  estado anterior; atualizar é somente GET, sem polling ou POST.
- AdminLayoutShell em frontend/app reúne os widgets existentes; o layout legado
  e o host web delegam a mesma apresentação. O seletor da locadora permanece
  acessível no main e vem da decisão original do gate, sem outro leitor ou
  seleção automática. Sem seleção o conteúdo privado fica fechado.
- Expo mantém a exceção aprovada de estados e link para o painel, sem novo
  cadastro, compra ou backoffice nativo.

A prova do checklist com o papel real do app agora inclui conta aprovada e
integração desativada. Sua implementação original foi preservada. O teste de
consulta respeita OWNER_MEMBERSHIP_REQUIRED ao preparar mudança de titularidade.

## 2. Scope

### Recuperação guiada entregue na onda 127

GET /api/admin/payment-account/recovery projeta somente recibos de plataforma do
incidente e da chave atuais: WAITING, CHECKING, REVIEW_REQUIRED,
SNAPSHOT_COMPLETE ou ACCESS_REQUIRED, contagem, data e disponibilidade do
pedido. Papel de plataforma isolado e READ ONLY; nenhum grant foi ampliado,
nenhuma credencial é decifrada e nenhum pagamento é consultado por esse papel.

POST no mesmo caminho exige origem exata do painel, sessão recente do motor,
dono atual com vínculo ADMIN ativo e corpo estrito `{ confirmation: true }`.
Locks revalidam conta, integração e chave; pedido em andamento é idempotente. O
comando enfileira o tópico payment-accounts.health existente, preservando
nextAttemptAt e leases. Uma intenção já concluída não engole outro pedido
explícito. O HTTP não faz chamada externa, não altera status e não retoma fila.

O consumidor grava recibos sanitizados de progresso/bloqueio depois da
conferência financeira. Divergência ou checkpoint inválido exige revisão;
indisponibilidade permite novo pedido explícito. Recibo de outra chave/incidente
não certifica a conta atual. A interface oferece confirmação/cancelamento e
consulta manual, limpa respostas antigas na troca de escopo e não repete POST
após resultado incerto. SNAPSHOT_COMPLETE conserva a mensagem de restrição.

Provas e limites da validação consolidada estão na seção da onda 127 de
`shared-api-host.md`.

### Nova fotografia financeira entregue na onda 128

Uma conferência concluída vale somente até seu corte temporal. Outro pedido
confirmado cria um incidente novo, auditado pelo dono e ligado ao anterior;
pagamentos já conferidos são consultados novamente e emissões posteriores entram
no novo corte. Recibos e checkpoints anteriores permanecem no histórico. Depois
do aceite, GET mostra WAITING com contagem zero até o job produzir o recibo
atual. Uma conferência incompleta conserva seu incidente e cursor.

Se já existe inspeção PENDING, o pedido usa a mesma agenda, sem antecipar
availableAt ou nextAttemptAt. PROCESSING ou lease vigente bloqueiam a troca;
pedidos concorrentes produzem um único ciclo. A auditoria, o novo incidente e
eventual enfileiramento têm commit conjunto. Resultado tardio de outro incidente
não publica conclusão/bloqueio para o ciclo atual. O painel explica a agenda e a
preservação do histórico antes da confirmação.

Reparo da entrega, retomada autorizada e confirmação de novos eventos continuam
pendentes. O [runbook de recuperação](../operations/runbook-asaas-webhooks.md)
separa essas etapas da fotografia financeira; não autoriza uma operação real.

### Conexão inicial entregue na onda 121

POST /api/admin/payment-account/connect é privado e exige origem do painel,
sessão recente verificada pelo motor e dono atual com vínculo ADMIN ativo. O
servidor confere e-mail verificado e CNPJ válido. Consulta o provedor fora da
transação SQL, depois revalida as mesmas condições e o CNPJ sob lock da
organização. O ambiente vem da configuração, nunca do corpo.

A chave entra no cofre existente; cifra, ativação da credencial, criação da
conta e auditoria têm commit conjunto. Repetir a mesma chave retorna o mesmo
aceite, sem outra consulta ou rotação. Outra chave, subconta ou integração
legada existente exige um fluxo separado e recebe conflito. O índice HMAC do
banco impede compartilhar chave entre locadoras; erro desfaz as escritas.

A prova da empresa usa
[GET dos dados comerciais](https://docs.asaas.com/reference/recuperar-dados-comerciais)
e a
[situação cadastral](https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta).
Não depende de um GET genérico /myAccount não documentado. O id da situação não
é tratado como id da conta. Não há chamada para criar conta, chave ou evento no
provedor.

O recibo estrito é 202 `{ accepted: true }`: a chave foi vinculada, mas a conta
fica RESTRICTED/WEBHOOK_MISSING e a integração PROVISIONING. Não certifica
recebimentos, não grava approvedAt nem documentVerifiedAt. Ainda faltam
identidade externa verificada, configuração de eventos e reconciliação antes de
liberar emissão; a interface de conexão continua pendente. Homologação real e
KMS/IP de produção não foram executados. Ver onda 121 de shared-api-host.md.

### Formulário de conexão própria — onda 124

/admin/recebimentos oferece a conexão inicial somente após o GET privado
confirmar que não existe conta. Uma conta existente conserva a consulta e não
ganha controle de substituição de chave. A interação fica na página FSD, sem
regra, rota, dependência ou configuração nova nos hosts.

O dono abre o formulário e confirma o envio explicitamente. O campo é mascarado,
não usa storage, URL, estado de retry ou persistência do modelo. A chave é
apagada do campo antes do envio, ao cancelar, na troca de locadora/sessão/
transporte, durante nova consulta, no unmount e em pagehide. O contrato Zod
existente valida o corpo; POST usa no-store. A mesma sessão de transporte
descarta a resposta tardia, e um lock local impede envio duplo.

Só 202 com o recibo estrito é aceite. Em seguida o GET relê o estado, sem
simular aprovação. Recusa de autenticação recente aponta ao login existente, sem
colocar chave ou ação no retorno. CNPJ, e-mail, integração existente e ambiente
exibem mensagens locais conhecidas. Erros de transporte e do provedor não são
ecoados. Resultado incerto fecha o formulário e permite somente nova consulta,
sem retry automático nem conservação da chave.

Validação local: 228 casos distintos em onze arquivos; tipos web/mobile,
arquitetura, nomes, tokens, higiene, ratchet e lint afetado verdes. Builds web e
legado passaram; o build legado final usa o PostgreSQL descartável disponível.
Chromium sobre a página compilada, com fixtures de API, confirmou 28
verificações de interface em desktop e largura de 390 px, sem erro de página.
Quatro verificações HTTP de recusa/cache também passaram. A sonda separada do
proxy registrou 403, esperado 401, e continua falhando; não foi descartada do
resultado nem convertida em prova de integração. Ver entrada 300 e onda 124 de
shared-api-host.md. Nenhuma conta Asaas real foi conectada; Expo conserva só
estados/link, e API legada, scheduler, flags e produção permanecem intactos.

### Prova do transporte pelo proxy — onda 125

A sonda anterior conectava ao loopback por fetch, que substituía o Host
informado e mantinha o Origin de app.localhost. Isso criava uma requisição
incoerente; o 403 era correto. O helper requestWeb existente preserva o host
transmitido. O proxy e a comparação de origem não foram alterados.

Vinte casos HTTP passaram em legacy e vinte em Better Auth: proxy Next real para
a API legada e o serviço, builds existentes, ponte TLS e banco locais. Sem
sessão, GET/POST seguem privados e devolvem 401; origem cruzada ou opaque e
same-site são recusados; cabeçalhos de borda enviados pelo cliente são
substituídos. Sessão do motor real chega pelo proxy e o vínculo CLIENT impede a
ação do dono, mesmo com ADMIN global. Dezessete testes unitários protegem o
transporte e os adapters/comando HTTP.

A prova não conecta conta do dono, não chama Asaas nem confirma aceite 202
autenticado pelo proxy. Aprovação, recuperação de fila, BaaS e homologação
continuam pendentes. Legado, scheduler e flags reais permanecem preservados. Ver
entrada 300 e onda 125 de shared-api-host.md.

### Aceite do dono com cofre pelo proxy — onda 126

A prova agora atravessa o proxy web compilado, sessão emitida pelo motor real e
os dois backends. O serviço usa seu entrypoint standalone. Cada execução cria um
PostgreSQL descartável, aplica migrate deploy e instala os scripts canônicos dos
papéis de negócio e plataforma com nomes próprios; não altera grants de outros
bancos. As consultas comerciais do Asaas são redirecionadas somente no processo
de teste para um provedor loopback; a proteção existente bloqueia outras
chamadas externas.

O dono recebe 202 com o recibo estrito. Conta, segredo cifrado e auditoria são
persistidos; a conta permanece RESTRICTED/WEBHOOK_MISSING e a integração
PROVISIONING. Repetições concorrentes conservam o mesmo registro e não consultam
novamente o provedor. A seleção real por cookie funciona, conflito com o
cabeçalho de locadora é recusado, ADMIN que não é dono não conecta e RLS oculta
a conta de outra locadora. CNPJ divergente, substituição de chave, ambiente
fornecido pelo cliente e origem irmã continuam recusados.

Validação final: 38 casos HTTP em legacy e 38 em Better Auth, incluindo os vinte
casos anteriores de recusa por motor; 32 unitários associados, tipos dos dois
arquivos novos e lint afetado passaram. Não comprova Asaas real, KMS/IP de
produção, aprovação comercial ou interface integrada em aparelho. Legado,
scheduler e flags reais permanecem ativos. Ver onda 126 de shared-api-host.md.

### Configuração e inspeção da conta conectada — onda 122

- O tópico existente `payment-accounts.health` usa o mesmo runtime e cron dos
  dois hosts. Só percorre contas próprias conectadas ao cofre, no ambiente
  configurado, com organização e integração elegíveis. Sem configuração completa
  do cofre, `PLATFORM_WEBHOOK_ORIGIN`, `PLATFORM_OPS_EMAIL` e ambiente, esse
  consumidor não é instalado. Não há segundo scheduler ou chave raiz como
  alternativa.
- Billing lista os webhooks por leitura completa e limitada. Cria uma única
  configuração inicial ou atualiza a configuração própria, com eventos
  conhecidos e entrega sequencial. Não altera webhooks de terceiros. Uma
  confirmação de escrita e uma nova leitura devem concordar antes de ativar a
  integração. I/O externo acontece fora da transação SQL.
- O cofre deriva uma autenticação recuperável, vinculada à locadora, integração,
  ambiente e identidade da chave ativa. Só seu SHA-256 é gravado na integração;
  token, chave e payload do provedor não entram no job, auditoria ou resposta. A
  intenção e o hash têm commit antes da escrita externa. Criação incerta retoma
  por GET e PUT do mesmo webhook; lista vazia não autoriza repetir POST.
- Uma inspeção diária reafirma a autenticação por PUT, pois GET não comprova o
  token instalado. Dados comerciais e os quatro estados cadastrais são relidos;
  só todos APPROVED permitem aprovação, preservando bloqueios e restrições
  anuais. A situação cadastral não vira identificador de conta ou carteira.
- Fila interrompida ou ausência de webhook anteriormente ativo exige
  reconciliação financeira. Nenhum reinício automático ocorre neste incremento.
  Falhas de leitura, indisponibilidade da chave e eventos de saúde preservam
  essa exigência e as intenções de criação/atualização, mantendo a conta
  restrita.
- São provas locais com transporte simulado, não homologação Asaas. A conexão
  guiada e a reconciliação permanecem pendentes. O POST inicial continua
  devolvendo 202 sem presumir prontidão; apenas o worker confirma a
  configuração.

### Reconciliação financeira da fila — onda 123

O job existente inicia um incidente durável antes de conciliar contas próprias
com fila interrompida ou webhook ativo desaparecido. Billing trabalha com o
papel de negócio e RLS da locadora; o papel de plataforma não ganha acesso a
pagamentos. Consulta no máximo cinco tentativas por entrega, fora de SQL, usando
somente a chave ativa daquela integração. Auditoria guarda o cursor, incidente,
identidade da chave e limite temporal da fotografia, sem segredos. Recriar o
processo retoma o cursor. Nova identidade da chave exige outra fotografia.
Checkpoint inválido, referência legada sem tentativa e emissão incerta não são
convertidos em prontidão.

A leitura estrita do Asaas conserva o leitor legado por padrão. Recuperação
recusa estado desconhecido/de risco, modalidade divergente, assinatura de
plataforma, valor inválido e pagamento sem data comprovada. Vínculo, chave,
referência externa, tentativa e obrigação são revalidados após o I/O. O
processador existente quita a obrigação vigente e enfileira a conversão
idempotente; pagamento antigo registra revisão sem quitar a cobrança nova.
Cancelamento confirma só a tentativa; estorno conserva o histórico. Efeito
financeiro e progresso têm commit conjunto.

`complete` significa apenas que a fotografia de tentativas vinculadas terminou.
Não cobre emissões posteriores ao seu limite temporal, dados não vinculados,
estornos parciais ou a disponibilidade do endpoint. A conta e a fila continuam
restritas; o job não executa PUT para reativá-las. Antes da liberação, faltam
revisão das divergências, prova de correção da entrega e reconciliação final
atualizada. O Asaas exige corrigir a falha antes de reativar e elimina eventos
armazenados por mais de 14 dias; a prova externa de novas entregas também é
necessária.
[Procedimento oficial](https://docs.asaas.com/docs/como-reativar-fila-interrompida).

Provas locais: 251 casos distintos em dez arquivos, transporte simulado,
PostgreSQL sem BYPASSRLS e composição dos dois crons. Sem nova rota, pool,
migration, grant, flag real ou alteração de produção. S9 permanece parcial.

Referências oficiais:
[criar webhook](https://docs.asaas.com/reference/criar-novo-webhook),
[atualizar webhook](https://docs.asaas.com/reference/atualizar-webhook-existente),
[listar webhooks](https://docs.asaas.com/reference/listar-webhooks) e
[autenticação entregue só na criação](https://docs.asaas.com/docs/create-new-webhook-via-api).

**In scope**

- Três modos exibidos (`PaymentAccountKind`):
  - `BAAS`: subconta Asaas BaaS, padrão de produção (documentos e saque dentro
    da plataforma);
  - `STANDARD`: subconta Asaas padrão, só no piloto;
  - `CONNECTED`: conta Asaas própria da locadora, conectada por chave (GB e
    plano B).
- `mode` e `subaccountModel` como no banco: subconta exige o modelo; conta
  conectada não tem modelo.
- Estados: `DRAFT`, `PROVISIONING`, `UNKNOWN`, `KEY_RECOVERY_REQUIRED`,
  `AWAITING_OWNER`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `RESTRICTED`,
  `BLOCKED` e `DISCONNECTED`; problemas de saúde da chave e do webhook.
- Visão do dono, criação e confirmação anual (faturamento mensal declarado em
  valor exato, celular e confirmação dos dados), conexão por chave, link de
  documentos e pedido de saque.

**Out of scope**

- Provisionamento BaaS, recuperação com reconciliação, confirmação anual e
  validação de saque (S9 e S14). A inspeção diária de conta própria conectada é
  parcial e local na onda 122.
- Telas/operação do cofre e migração assistida das credenciais `env:` (S7). A
  fundação S3 e o resolvedor optativo VAULT estão implementados localmente na
  onda 87; a onda 88 acrescenta importação assistida de uma integração por plano
  confirmado. A onda 89 inclui o userAgent cifrado do Melhor Envio e grace HMAC
  limitado, além de persistir recebimentos durante bloqueio administrativo sem
  aplicar efeitos antes do desbloqueio. Não há importação automática, conexão de
  contas ou troca de segredos reais. Provas e limites em `shared-api-host.md`.

## 3. Entry Points

- Contrato: `packages/contracts/src/payment-account.ts`, exportado como
  `@gb-locacoes/contracts/payment-account`.
- Consulta instalada nos dois hosts: `GET /api/admin/payment-account` (só o
  dono).
- Conexão inicial instalada nos dois hosts:
  `POST /api/admin/payment-account/connect` (só o dono; recebimentos restritos).
- Criação instalada nos dois hosts (onda 134):
  `GET /api/admin/payment-account/create` (oferta) e
  `POST /api/admin/payment-account/create` (pedido; 202 `{ accepted: true }`),
  só o dono, desligada por padrão (`PLATFORM_SUBACCOUNT_CREATION`).
- Worker `payment-accounts.provisioning` e manutenção dos pedidos no cron
  `/api/cron/platform` dos dois hosts.
- Barreira de emissão: `assertReceivingAccountReady` (billing), chamada por
  `createPaymentRequests` e pelo boleto manual de orçamento.
- Rotas futuras (B.13, só o dono):
  `POST /api/admin/payment-account/{documents-link,confirm-commercial-info,payouts}`.

## 4. Core Flow

1. O dono pede "Ativar pagamentos online" (nunca automático no cadastro, D10) e
   confirma os dados já coletados, com o faturamento mensal exato e o celular.
2. A conta passa por `PROVISIONING` e `AWAITING_OWNER` (envio de documentos) até
   `UNDER_REVIEW` e `APPROVED`.
3. No BaaS, o link de documentos é pedido na hora, entregue só ao dono com
   `no-store` e nunca gravado.
4. Na conta conectada, o dono cola a chave de API numa tela `no-store`; o
   servidor confere que a conta tem o mesmo CNPJ.
5. O saque (só BaaS) leva apenas o valor: o destino é sempre a conta bancária do
   próprio CNPJ cadastrada no Asaas.

## 5. Components and Files

- `packages/contracts/src/payment-account.ts`
- `packages/contracts/src/payment-account.test.ts`
- `packages/backend/src/modules/payment-accounts/{owner-authorization,owner-create,subaccount-company,subaccount-binding,subaccount-provisioning,provisioning-request,provisioning-requests-maintenance,account-webhook-target,configuration,webhook}.ts`
- `packages/backend/src/modules/billing/receiving-account-readiness.ts`
- `packages/backend/src/http/owner-payment-account-create.ts`
- `packages/backend/src/runtime/{subaccount-creation,platform-jobs}.ts`
- `apps/services/api/src/app/api/admin/payment-account/create/route.ts`:
  GET/POST privado com principal ativo; o runtime revalida dono e vínculo. A
  antiga `app/api/admin/payment-account/create/route.ts` foi retirada em F.
- `packages/frontend/src/pages/recebimentos-admin/` (`api/creation-offer.ts`,
  `api/create-account.ts`, `model/use-account-creation.ts`,
  `model/valor-faturamento.ts`, `ui/AccountCreation.web.tsx`)
- `prisma/migrations/202610060101_payment_account_provisioning_requests/migration.sql`
- `docs/operations/runbook-asaas-subaccount.md`

## 6. Data and State

- Tabelas S2 presentes desde a onda 85: `payment_accounts`,
  `integration_secrets`, `payout_requests`.
- Consumidor em `packages/backend/src/modules/payment-accounts` usa fatos atuais
  via billing, com credencial da própria locadora no runtime. Subconta verifica
  expiração anual separadamente da aprovação; conta conectada preserva a
  informação anual anterior quando a API não a oferece. Recibo, projeção e
  auditoria têm commit conjunto; conflito, rotação e bloqueio são preservados.
  Chave expirada/rejeitada restringe a saúde sem liberar conta BLOCKED. Eventos
  de chave precisam coincidir com o id da credencial ativa no cofre; ENV_REF sem
  essa identidade permanece com auditoria de evento não correlacionado.
- A visão do dono tem só modo, estado, ambiente, saúde, texto de status do
  provedor e datas. Nunca: chave, token, `credentialsRef`, `walletId`, id da
  conta no provedor, `onboardingUrl` gravado, faturamento declarado, celular ou
  dado bancário.
- Faturamento declarado e celular: só em
  `payment_account_provisioning_requests`, lida pelo papel de plataforma, e só
  enquanto ainda pode haver POST (purga em todo outro desfecho, D-2).
- `PLATFORM_ASAAS_SUBACCOUNT_MODEL` usa os mesmos valores de
  `SubaccountModelSchema` (`BAAS` ou `STANDARD`).

## 7. Constraints and Edge Cases

- A chave colada aceita o formato antigo (`$aact_<base64>`) e o novo
  (`$aact_prod_…`, `$aact_hmlg_…`); o ambiente não vem do dono. A mensagem de
  erro do zod não repete o valor. Nunca registre esse objeto.
- O faturamento é o valor mensal exato em reais com duas casas
  (`Decimal(12,2)`); o que o Asaas aceita (por exemplo, `0.00`) é
  VERIFICAR-SANDBOX (S15). Uma faixa declarada nunca é convertida em valor (o
  preflight da migration 202610060101 aborta se houver alguma).
- Suposições ainda não confirmadas no sandbox estão marcadas com
  `VERIFICAR-SANDBOX` no contrato e no adapter.
- Criação de subconta (lote S4, onda 3): `parseAsaasAccountCreation` aceita a
  chave em `apiKey` ou em `accessToken.apiKey` e a guarda num `AsaasSecretValue`
  que nunca é serializado; sem chave na resposta, `credential` fica `null` (o S9
  pode ir para `KEY_RECOVERY_REQUIRED`). Detalhes em
  `docs/features/modernization-billing.md`.
- Vocabulário de tela: "conta de recebimentos"; nunca "subconta", "KYC" ou
  "webhook".

## 8. Error Handling

- Cobrança pedida sem conta aprovada: 409 `PAYMENT_ACCOUNT_NOT_READY` (ver
  `docs/features/limites-plano.md`). Instalada na onda 134 para subconta
  (`APPROVED`, dados comerciais válidos e integração `ACTIVE`); locadora sem
  conta e conta conectada não mudam.
- Pedido da conta: 400 `INVALID_INPUT` (sem eco), 401 `FRESH_SESSION_REQUIRED`,
  402 `SUBSCRIPTION_RESTRICTED`/`MODULE_NOT_IN_PLAN`, 403 `OWNER_REQUIRED`,
  `EMAIL_NOT_VERIFIED`, `TENANT_ARCHIVED`, 409 `COMPANY_DATA_CHANGED`,
  `FIRST_PAYMENT_REQUIRED`, `PAYMENTS_NOTICE_REQUIRED`, `DOCUMENT_IN_USE`,
  `PAYMENT_ACCOUNT_ALREADY_EXISTS`, `PAYMENT_INTEGRATION_ALREADY_EXISTS` e
  `PAYMENT_ACCOUNT_CREATION_UNAVAILABLE`.
- Ações só do dono: 403 `OWNER_REQUIRED` ou `FRESH_SESSION_REQUIRED`.

## 9. Performance and Accessibility

- Contrato puro e universal (só zod).
- A tela para leigo (S11b) segue o checklist da seção B.7.2 do ADR.

## 10. Tests and Validation

- `pnpm exec vitest run --config vitest.platform.config.ts packages/contracts`
- Os testes provam: coerência de modo e modelo; os três modos exibidos; estados
  do banco; visão sem nenhum campo sensível; criação com valor exato em string,
  só celular e versão dos dados; oferta estrita; os dois formatos de chave; erro
  sem ecoar a chave; link só no domínio do Asaas; saque sem destino digitado.
- Onda 134, parte A: `tests/identity/subaccount-provisioning-database.test.ts`
  (oferta e pedido em PostgreSQL com papéis canônicos e matriz do worker com o
  dublê), `tests/unit/owner-payment-account-create-http.test.ts`,
  `tests/unit/{asaas-subaccounts,owner-payment-account-connect,uncertain-subaccount-recovery}.test.ts`,
  `tests/identity/platform-scope-database.test.ts` (tabela de pedido) e
  `tests/unit/migration-preflight-rls.test.ts` (preflight sob FORCE RLS e
  recuperação Prisma).
- Onda 134, parte B: no mesmo arquivo de banco, a saúde depois da criação
  (S23/S27), a aprovação e a regressão (S24), o evento antes da saúde (S34), o
  evento durante a criação (S25), a saúde nunca tocando estados de criação
  (M14), a composição real com os dois crons (S18) e a manutenção sem
  interruptor nem raiz (M31); `tests/unit/billing-database.test.ts` (barreira,
  S33);
  `tests/unit/{connected-account-configuration,subaccount-creation-configuration,owner-payment-account-create-routes,subscription-request-access}.test.ts`;
  `tests/security/secret-leak.test.ts` (T-S3);
  `tests/api-host/owner-payment-account-create.http.test.ts` e o caso de criação
  desligada em `owner-payment-account-connect.http.test.ts` (proxy compilado,
  dois hosts, dois motores); testes da página em
  `packages/frontend/src/pages/recebimentos-admin`.
- Onda 134, segunda rodada (provas pedidas pelos verificadores, cada uma morta
  por mutação): o corpo do único POST e os dados da conta criada trazem o valor
  e o celular exatos (S1, S18 e o caso do cron em
  `owner-payment-account-create.http.test.ts`); troca de dono, arquivamento ou
  bloqueio durante a busca liberam o pedido sem POST (S35); arquivamento durante
  o POST (S19b); pedido purgado fora do fluxo, no claim e durante a busca (S36);
  chave recuperada à mão durante o POST (S37); a primeira intenção vence, não o
  primeiro pedido (S38); a manutenção purga cada estado sem POST possível com o
  motivo do estado (S39) e confere o lease de novo sob o lock (S40); Retry-After
  da busca e entrega antes da hora sem efeito (S5); replay recusado depois do
  claim, celular sugerido só se for celular, desfecho do pedido mais recente,
  versão cobrindo cada campo enviado (o site inclusive), aceite futuro do aviso,
  fiscalização inválida fechada e papel diferente de ADMIN recusado (oferta e
  pedido). `secret-leak.test.ts` lê o console como ele é impresso (objetos,
  erros e causas em profundidade). A mutação que retira o filtro `withdrawnAt`
  do aviso do parceiro é equivalente: o banco recusa aviso retirado
  (`legal_withdrawal_marketing_only`), e o teste prova essa recusa.
- Onda 134, terceira rodada (seis lacunas do verificador, cada mutação
  sobrevivente agora morta; a produção já estava correta): só o aceite do aviso
  do parceiro pelo dono atual vale, nunca o do dono anterior; replay só com a
  mesma versão dos dados (um segundo pedido depois de os dados mudarem é 409);
  pedido cancelado ou devolvido de outra locadora não segura o CNPJ, e locadora
  legada com CNPJ formatado e sem a coluna normalizada segura o dela com a conta
  atual; a conta conectada ativa a integração na confirmação mesmo com o
  provedor ainda analisando, e a cobrança a seleciona; a barreira lê só a conta
  atual, com subconta cancelada antes de uma conta conectada ou de uma subconta
  nova (todas em `subaccount-provisioning-database.test.ts`, mais o caso
  unitário em `connected-account-configuration.test.ts`). Com
  `CREATION_UNAVAILABLE`, `RecebimentosPage.connection.web.test.tsx` compara o
  HTML inteiro da página com o da página sem oferta de criação (sem cartão nem
  parágrafo vazio).
- Onda 134, reparo da terceira rodada: a posse do CNPJ por locadora legada vale
  com o documento só em dígitos ou formatado, sem a coluna normalizada. A
  re-verificação achou um defeito de produção na confirmação da saúde, em
  `configuration.ts`. A primeira aprovação completa gravava só
  `documentVerifiedAt`. Isso quebrava em dois casos, e cada quebra desfazia a
  confirmação inteira a cada inspeção. O primeiro é a locadora legada sem
  `documentNormalized`, que viola o CHECK `organizations_document_verified`. O
  segundo é o CNPJ já verificado por outra locadora, que viola o índice único
  `organizations_verified_document`. Nos dois casos, a subconta ficava
  `RESTRICTED` com a integração `PROVISIONING`, e a conta conectada aprovada
  nunca ativava a integração. Agora a verificação grava também o CNPJ
  normalizado. CNPJ já verificado em outra locadora fica sem verificar e vai
  para revisão uma vez. As provas estão no bloco B6/B7 de
  `subaccount-provisioning-database.test.ts`: locadora legada com documento
  formatado ou com outra máscara, por subconta e por conta conectada, e CNPJ
  verificado antes por outra locadora, por subconta e por conta conectada. Há
  também o caso unitário em `connected-account-configuration.test.ts`.
- Onda 134, reparo final (pontos do verificador): duas locadoras verificando o
  mesmo CNPJ ao mesmo tempo, reproduzidas no banco com a verificação rival presa
  até a confirmação esperar o índice único. A perdedora fica `RESTRICTED` com
  `ACCOUNT_CONFIGURATION_UNAVAILABLE` e, 5 min depois, aprova e vai para
  revisão, com um único POST. Antes, a conta conectada ficava com
  `WEBHOOK_CREATE_UNKNOWN`, herdado da intenção de criação já confirmada. O caso
  unitário equivalente é o do CNPJ trocado depois da confirmação
  (`COMPANY_DATA_CHANGED`), mais a leitura de confirmação indisponível, que
  segue incerta e nunca repete o POST. Colunas de CNPJ divergentes (só a legada,
  as duas, ou legada sem a normalizada) terminam em `ACCOUNT_DOCUMENT_MISMATCH`
  sem gravar CNPJ nem verificação, por subconta e por conta conectada. Cada
  mutação morre: a correção, a reconferência sob o lock, a comparação entre as
  colunas e a comparação com o provedor.

## 11. Related Docs

- `docs/architecture/adr-saas-subscription.md`
- `docs/features/assinatura-plataforma.md`
- `docs/features/modernization-billing.md`

## 12. Change Log

- 2026-09-26: Contrato da conta de recebimentos criado (lote S0).
- 2026-09-26 (onda 3, commit `be859915`): parser da criação de subconta e
  cliente HTTP único do Asaas (lote S4).
- 2026-10-03 (onda 91, sem commit): saúde por eventos com reconsulta, consumidor
  compartilhado e correlação de metadados pelo cofre; parte de S9. Sem operação
  real ou implantação. Evidências e pendências em `shared-api-host.md`.
- 2026-10-04 (onda 122, sem commit): configuração inicial e inspeção diária da
  conta conectada, com retomada conservadora e autenticação recuperável. Eventos
  não apagam intenções de configuração; aprovação exige os quatro estados.
  Reconciliação e homologação permanecem pendentes.
- 2026-10-07 (onda 134, parte A, sem commit): faturamento mensal exato no
  contrato, tabela de pedido só da plataforma com purga, oferta e pedido do
  dono, worker de criação com selagem imediata e inspeção da onda 129 com purga
  e espera em recusa da chave raiz. Rotas, flag, saúde, barreira e tela na parte
  B.
- 2026-10-07 (onda 134, parte B, sem commit): rotas `create` nos dois hosts,
  composição nos crons com a manutenção sempre instalada, interruptor
  `PLATFORM_SUBACCOUNT_CREATION` desligado por padrão, saúde da subconta com
  integração ativa só na aprovação, consumidor de eventos que ignora subconta em
  criação, barreira 409 `PAYMENT_ACCOUNT_NOT_READY`, formulário web e runbook.
- 2026-10-07 (onda 134, segunda rodada, sem commit): a tela troca o aviso de
  pedido aceito pelo motivo e um formulário novo quando a consulta seguinte não
  acha conta (pedido devolvido ou cancelado na mesma sessão); provas novas do
  valor exato no POST, da liberação por mudança durante a busca, das saídas de
  integridade, da manutenção e do console na varredura de vazamento.
- 2026-10-07 (onda 134, terceira rodada, sem commit): só provas, sem mudança de
  produção: aceite do aviso pelo dono atual, replay com a mesma versão dos
  dados, posse do CNPJ só por conta atual (inclusive legado formatado), ramo da
  conta conectada inalterado, barreira só com a conta atual e página igual à de
  antes com a criação indisponível.
- 2026-10-07 (onda 134, reparo da terceira rodada, sem commit): correção na
  confirmação da saúde. A verificação do CNPJ grava também o CNPJ normalizado
  (locadora legada). CNPJ já verificado por outra locadora não é verificado de
  novo e vai para revisão (`payment-account.document.in-use`). Antes, os dois
  casos desfaziam a aprovação a cada inspeção. Há prova nova da posse do CNPJ
  por locadora legada com o documento só em dígitos.
- 2026-10-07 (onda 134, reparo final, sem commit): falha depois de o webhook
  criado ser confirmado grava o próprio código, não `WEBHOOK_CREATE_UNKNOWN`.
  Provas novas da corrida de verificação do mesmo CNPJ e das colunas de CNPJ
  divergentes.

---

_Template version: 2026-01-20_
