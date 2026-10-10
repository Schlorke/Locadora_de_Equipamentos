# Cadastro da locadora (onboarding)

> **Status**: Critical — S10/S11a/S11b parciais, assistente web, checklist
> web/Expo e cadastro público desligado
>
> **Last updated**: 2026-10-04

---

## 1. Purpose

A locadora se cadastra sozinha em `app.<raiz>/comecar` e sai com a organização,
o dono, a assinatura (em teste ou aguardando a primeira fatura), os aceites dos
termos e as configurações iniciais, tudo criado numa única transação. Esta
página descreve o contrato do cadastro, definido pelo ADR
`docs/architecture/adr-saas-subscription.md` (B.8, D10, D19, D20, D21 e D23).

S0/S1/S2 entregam contratos, validação e persistência. A onda 112 instala o caso
de uso atômico de S10 e a CLI assistida sobre esses mesmos contratos. A onda 113
acrescenta os adaptadores HTTP autenticados e o checklist do dono nos dois
hosts. A onda 114 instala o consumidor durável de boas-vindas na composição de
jobs existente. A onda 115 acrescenta o comando autenticado de publicação pelo
dono. A onda 116 monta o checklist no dashboard compartilhado, com confirmação
web e abertura do painel no Expo. A onda 117 acrescenta a consulta anônima das
opções e dos textos jurídicos aprovados no host do painel. A onda 118 acrescenta
as APIs de conta mínima, confirmação de e-mail e reenvio limitado sobre o motor
existente, preservando o cadastro de clientes. A onda 119 instala o assistente
web /comecar sobre essas APIs. O cadastro público continua desligado;
recebimentos, LIVE/PAUSED/OFF de S13 e homologação externa seguem pendentes.

### Opções e textos aprovados para S11a (onda 117)

A consulta usada pelo assistente da onda 119 entrega o domínio raiz, a chave
pública do captcha e os textos exatos dos documentos aprovados.
OnboardingOptionsResponseSchema valida a resposta estrita; quatro documentos
obrigatórios e marketing opcional devem coincidir com a publicação operada fora
do repositório.

PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE aponta para um JSON externo, com caminho
absoluto, cujo mapa é kind para texto UTF-8 exato. O manifesto existente em
PLATFORM_LEGAL_DOCUMENTS_FILE continua sendo a fonte de versão e SHA-256
aprovados. A leitura aceita somente arquivo regular de até 256 KiB; não busca
URLs, não normaliza espaços/quebras de linha e não executa HTML. O futuro
consumidor deve renderizar texto escapado. Rascunhos não são textos aprovados.

Signup off devolve somente mode off antes de ler esses arquivos. A configuração
real permanece off. GET/HEAD exigem contexto app genuíno e origem exata quando
fornecida; não recebem query, mutações, CNPJ, e-mail ou senha. A resposta é
private, no-store, com Vary Cookie, Host. Erros de arquivo/configuração são
neutros. O contrato existente de criação e aceites não foi alterado.

235 casos distintos e 90 verificações HTTP nos dois hosts compilados passaram;
publicação e configuração on são sintéticas e isoladas. Não constituem aprovação
jurídica, homologação de captcha, login ou lançamento do cadastro público.
Provas e limites na onda 117 de shared-api-host.md.

### Conta mínima e confirmação do dono (onda 118)

POST /api/auth/owner-register recebe somente nome, e-mail e senha. O contrato
estrito em contracts/credentials exige dez caracteres e no máximo 72 bytes
UTF-8; não aceita papel, empresa, documentos ou confirmação fornecidos pelo
visitante. Contexto app genuíno, origem exata, configuração/publicação aprovada,
limites persistentes e captcha/senha comprometida antecedem a criação. O motor e
o envio após commit são os existentes; o contexto mínimo interno não pode ser
ligado por flag de requisição. Cadastro de clientes permanece como antes.

GET /api/auth/owner-account devolve somente userId e emailVerified da linha do
usuário autenticado. POST /api/auth/owner-verification aceita objeto vazio e
reenvia somente para aquele endereço quando não verificado e dentro das janelas
persistentes de minuto/dia. Orçamento gasto ou conta já confirmada mantém 202
neutro, Retry-After 60 e cache privado. Resend recusa origem cruzada antes da
sessão; todas as respostas conservam private/no-store/Vary Cookie, Host. Nenhuma
dessas operações cria empresa, vínculo, assinatura ou login.

O token foi reenviado e consumido pelo motor real no banco descartável, com
e-mail simulado. Os dois builds e HTTP local com signup off passaram; parceiros
e sessão em navegador não foram homologados. A flag real permanece off. O
assistente web foi instalado na onda 119; Expo continua apenas com estados/link
do painel.
[Provas e limites](shared-api-host.md#onda-118--conta-minima-e-confirmacao-de-e-mail-2026-10-04-sem-commit).

### Assistente web e retomada do pedido (onda 119)

app.<raiz>/comecar monta uma página FSD de sete etapas. Conta usa somente
nome/e-mail/senha e o motor de identidade existente; empresa só aparece após o
fato de confirmação recebido do servidor. Registro e reenvio de confirmação do
dono retornam ao assistente por callback fixo /comecar. O cadastro comum de
clientes conserva seu contrato e callback anterior.

Empresa e escolha de endereço/plano ficam no navegador, em chave separada por
usuário, conforme B.8. Senha e captcha nunca entram no rascunho. Cada documento
aprovado é apresentado como texto escapado; aceites começam desmarcados e não
são restaurados como consentimento. Preço, prazo de teste e limites vêm do
catálogo mensal vigente, sem inventar planos. Respostas antigas de outra sessão
não repõem dados nem alteram a intenção atual.

Somente o botão final cria a empresa. O corpo e a chave de idempotência são
guardados antes do pedido; falha incerta bloqueia edição e permite confirmação
manual do mesmo corpo/chave, inclusive após recarregar. Um novo desafio é usado
em cada envio. Recibo limpa apenas o rascunho desse dono e oferece o painel; não
publica o site, ativa recebimentos ou navega automaticamente.

O host contém apenas rota, login e adapter de captcha do navegador. O componente
reutiliza o design system e as APIs compartilhadas. Expo não ganha wizard,
compra ou backoffice. Cadastro real permanece off; a tela fechada não monta
campos nem desafio. Não houve mudança de proxy, scheduler, produção ou tráfego.
Provas e limites na onda 119 de shared-api-host.md.

## 2. Scope

**In scope**

- Etapas: `ACCOUNT`, `EMAIL_VERIFICATION`, `COMPANY`, `SITE_ADDRESS`, `PLAN`,
  `TERMS` e `CREATE`.
- Dados da empresa: CNPJ, razão social, nome fantasia, tipo, celular ou
  WhatsApp, CEP, endereço, cidade, UF e a declaração "tenho poderes para
  representar a empresa".
- Forma do CNPJ numérico e alfanumérico (válido desde julho de 2026).
- Endereço do site: consulta de disponibilidade e sugestões.
- Aceites de Termos de Uso, Política de Privacidade, Acordo de Tratamento de
  Dados e aviso do parceiro de pagamentos; marketing à parte e opcional.
- Criação com `Idempotency-Key`, resposta, checklist "Primeiros passos" e erros.
- Assistente web /comecar, conta mínima, confirmação de e-mail e rascunho
  separado por usuário, com confirmação manual de criação.
- Comando de publicação pelo dono, com e-mail verificado, acesso FULL e ao menos
  um equipamento da própria locadora; recibo e auditoria persistidos.
- `blockedSlugTerms` e `disposableEmailDomains` em
  `packages/contracts/src/platform.json`, com `hasBlockedSlugTerm`,
  `isSignupSlug` e `isDisposableEmail` em `platform.ts`.

**Out of scope**

- Wizard no Expo, retirada de publicação, exportação e backoffice assistido.
- Vitrine LIVE/PAUSED/OFF e efeitos públicos de assinatura (S13).
- Entrega externa de boas-vindas: consumidor e recibo de aceite existem, mas as
  provas locais usam envio simulado.
- Troca ou homologação do provedor de identidade (H6). O desafio de criação da
  organização tem validação no servidor; isso não substitui a proteção do
  cadastro de conta nem homologa o provedor externo.
- Homologação externa, textos jurídicos e planos comerciais aprovados. O caso de
  uso não inventa esses documentos ou ofertas.

## 3. Entry Points

- Produto web: packages/frontend/src/pages/onboarding, consumido pela rota
  apps/clients/web/src/app/(auth)/comecar/page.tsx. Login e captcha ficam nos
  adapters apps/clients/web/src/host/onboarding.
- Catálogo comum: packages/frontend/src/entities/plano, reutilizado pela tela de
  reativação de assinatura.
- Contrato: `packages/contracts/src/onboarding.ts`, exportado como
  `@gb-locacoes/contracts/onboarding`.
- Configuração: `packages/contracts/src/platform.json` e `platform.ts`.
- Caso de uso: `packages/backend/src/modules/onboarding/index.ts`, com
  `createOrganizationProvisioning` e `readSignupSlugAvailability`.
- Composição única de plataforma:
  `packages/backend/src/runtime/platform-jobs.ts`, exportando
  `runAssistedOrganizationProvisioning` por `@gb-locacoes/backend/runtime`.
- CLI: `pnpm platform:provision`, em `tools/platform-provision-tenant.mjs`.
- HTTP (B.13): `GET /api/onboarding/slug-availability`,
  `POST /api/onboarding/organizations`, `GET /api/onboarding/status`, em
  `apps/services/api/src/app/api/onboarding`. Na onda113 coexistiam também em
  `app/api/onboarding` da raiz antiga, retirada em F. Os handlers compartilhados
  ficam em `packages/backend/src/http`; a composição de criação é
  `handleConfiguredOnboarding`, no runtime existente. As fachadas de leitura dos
  hosts somente fornecem a transação de locadora.
- Opções de cadastro: `GET /api/onboarding/options`, no host API, sobre
  `handleConfiguredOnboardingOptions`. Leitura anônima limitada ao contexto
  genuíno do painel; não cria conta, não consulta banco e não publica segredos.
- Publicação: `POST /api/admin/site/publish`, no host API, delegando para
  `handleConfiguredSitePublication` no runtime compartilhado. Caso de uso em
  `packages/backend/src/modules/onboarding/site-publication.ts`; corpo vazio ou
  `{}`, resposta estrita `SitePublicationResponseSchema`.

## 4. Core Flow

1. Passos 1 e 1b: conta com e-mail verificado (provedor de identidade).
2. Passo 2: `CompanyDataSchema` normaliza CNPJ (sem máscara, maiúsculas),
   telefone (DDD e número) e CEP (8 dígitos).
3. Passo 3: `GET /api/onboarding/slug-availability` responde só
   `{ available: true }` ou `{ available: false, suggestions }`, sem motivo.
4. Passo 4: plano escolhido por `planVersionId` (catálogo público).
5. Passo 5: cada aceite leva `kind`, `version` (data de publicação) e
   `textSha256` do texto exibido; o servidor confere com o documento vigente.
6. Passo 6: `POST /api/onboarding/organizations` com `Idempotency-Key`. A mesma
   chave devolve a mesma organização. Teste já usado por CNPJ ou e-mail cria a
   assinatura `INCOMPLETE`, com o aviso `TRIAL_ALREADY_USED`.
7. Depois: checklist "Primeiros passos" (`GET /api/onboarding/status`).

### Incremento assistido implementado (onda 112)

1. Operador fornece dono e operador explícitos, corpo estrito e chave estável. O
   dono deve ter e-mail verificado e não descartável; o operador deve ser
   PLATFORM_ADMIN ativo e não revogado. Equipe ativa não pode ser dona de
   locadora; histórico de vínculo inativo não impede o cadastro.
2. Um recibo já confirmado é devolvido após revalidar identidade/operador, sem
   consumir limites novamente. Mesma chave com outro corpo normalizado recusa. O
   recibo permanece o da criação mesmo após mudar catálogo, termos ou estado.
3. Tentativas novas consomem contadores persistidos: três/dia por usuário e
   cinco/dia por IP, com chaves HMAC. Ausência de IP usa um contador comum. Essa
   transação separada sobrevive à recusa ou rollback do provisionamento.
4. Locks serializam dono, slug e chaves de teste. No máximo três organizações
   por dono. Reservado, bloqueado e ocupado têm a mesma recusa e até cinco
   sugestões; o índice único também protege escritores fora desses locks.
5. O plano deve ser mensal, público e vendável no catálogo persistido. O caso
   reutiliza `publicOfferWhere`, bloqueia plano/versão para leitura e revalida a
   identidade e os documentos vigentes antes das gravações.
6. Uma única transação cria organização, vínculo ADMIN do dono, assinatura,
   evento, aceites, quatro tabelas de sementes, auditoria e outbox. CNPJ/email
   de teste são HMAC canônicos compartilhados com os registros existentes. Sem
   teste anterior e com dias configurados, cria TRIALING/FULL; caso contrário,
   INCOMPLETE/SETUP. Teste já utilizado informa TRIAL_ALREADY_USED. Uma recusa
   de teste não consome novas reivindicações de teste.
7. Site permanece não publicado, não indexável e fora do diretório. O CNPJ é
   validado, mas não marcado como verificado pelo provedor. Enfileira
   `onboarding.welcome` e, em INCOMPLETE, `subscriptions.provider-sync`, usando
   o consumidor de emissão existente. Nenhuma chamada Asaas ocorre no cadastro.

### Boas-vindas duráveis (onda 114)

O evento criado na transação de provisionamento é consumido por
`packages/backend/src/modules/onboarding/welcome.ts`. O runtime existente de
plataforma instala o consumidor quando RESEND_API_KEY, FROM_EMAIL e origem
canônica estão configurados. Independente da flag de signup e da chave Asaas:
cadastros assistidos também recebem a mensagem. Configuração incompleta deixa os
eventos PENDING sem reclamar o tópico ou consumir tentativas.

Antes de cada tentativa, confere organização ONBOARDING/ACTIVE, dono atual com
vínculo ADMIN ativo, contato verificado e não descartável, e ausência de equipe
ativa. O envelope de um destinatário é congelado antes de chamar o transporte;
inclui link canônico `https://app.<raiz>/admin`, texto e HTML escapado. Não usa
SMTP, logo, scripts ou marca de uma locadora para a mensagem da plataforma.

Retry conserva o envelope e a chave do evento. Mudança de dono, contato,
conteúdo ou perda de elegibilidade exige conciliação. A janela local é de 23
horas, conservadora em relação às 24 horas da chave no
[Resend](https://resend.com/changelog/idempotency-keys). A quarentena e sua
auditoria são confirmadas antes da falha terminal. Depois do aceite do provedor,
acceptedAt durável permite terminar uma retomada sem enviar novamente. Isso
certifica aceitação, não entrega na caixa de entrada.

### Comando de publicação pelo dono (onda 115)

O comando exige sessão ADMIN, origem exata do host app e dono atual revalidado
no banco. Revalida organização ACTIVE, acesso FULL e e-mail verificado. Essa
operação nova exige FULL mesmo com a fiscalização geral off; nenhuma flag real é
ativada. SETUP/RESTRICTED recebem 402, ARCHIVED recebe 403 e ausência de
equipamento recebe 409. Não aceita locadora, data ou atributos de indexação no
corpo; o limite efetivamente lido é 1 KiB e a resposta é privada/no-store.

O papel de plataforma mantém o mesmo lock consultivo das mutações de catálogo e
locação até o commit. Em seguida bloqueia a organização, revalida o dono e
consulta somente a contagem de equipamentos num escopo de locadora READ ONLY,
pelo papel de aplicação. Plataforma não lê tabelas empresariais. Grava apenas
sitePublishedAt e a auditoria SITE_PUBLISHED na mesma transação. Falha da
auditoria desfaz a data; a exclusão concorrente do último equipamento tem ordem
definida pelo lock comum.

Repetição revalida dono/acesso/e-mail e devolve a primeira data confirmada, sem
gravar outra auditoria ou depender de uma segunda chave. A primeira publicação
torna o slug imutável pelo trigger existente. O comando não altera
siteIndexable, directoryListed ou a política de recebimentos. Não implementa
DELETE/despublicação nem os modos públicos S13: o resolvedor público atual
continua baseado em Organization.status=ACTIVE. O recibo de publicação não
certifica a interface pública final nem indexação.

### Operação da CLI e publicação jurídica

Sem `--apply`, a CLI somente confere o arquivo/corpo e mostra uma prévia local;
não abre conexão, consulta elegibilidade ou certifica que o cadastro será
aceito.

```powershell
pnpm platform:provision --input-file="C:\CAMINHO\cadastro.json" --owner=OWNER_USER_ID --operator=PLATFORM_ADMIN_USER_ID --key=STABLE_IDEMPOTENCY_KEY
```

`--apply` executa o caso de uso. Exige a conexão isolada de `platform_runtime`
pela composição existente, `PLATFORM_ASAAS_ENVIRONMENT` explícito,
`PLATFORM_TRIAL_SECRET`, `PLATFORM_RATE_LIMIT_SECRET` e
`PLATFORM_LEGAL_DOCUMENTS_FILE`. Não há fallback para credenciais de negócio,
carregamento implícito de `.env` ou alteração de flags. O pool próprio fecha
também em falha. Arquivos de entrada e publicação têm caminho absoluto e limite
de 16 KiB. A CLI devolve códigos permitidos; mensagens arbitrárias de banco,
arquivo ou provedor não chegam à saída.

O arquivo de publicação é um array de metadados estritos `kind`, `version` e
`textSha256`, com os quatro documentos obrigatórios e marketing opcional, sem
duplicatas ou data futura. Deve representar textos aprovados e publicados,
operados fora do repositório. Não contém segredos nem constitui aprovação
jurídica. O corpo do cadastro nunca escolhe a publicação confiável. Hash/versão
aceitos devem coincidir com a publicação; falta ou mudança impede a criação. Os
testes usam apenas documentos sintéticos, sem homologar consentimento real.

A CLI depende da autorização operacional do ambiente local e de um operador
nomeado; não constitui prova de sessão/MFA. O adaptador HTTP da onda 113 deriva
identidade da sessão e aplica suas próprias guardas e flags antes deste caso.

### HTTP autenticado e checklist implementados (onda 113)

Os dois hosts instalam os mesmos três adaptadores sobre o backend compartilhado.
Criação e disponibilidade exigem sessão de conta. Status exige principal de
locadora ADMIN e revalida vínculo ativo, organização e dono atual dentro do
snapshot READ ONLY/Repeatable Read existente. Cookie de locadora selecionada é
somente preferência, nunca autorização. Todos os corpos dos handlers têm
`private, no-store` e `Vary: Cookie, Host`.

Fora de development, somente a borda autenticada de `app.<raiz>` é aceita;
tenant, apex, segredo forjado e origem irmã são recusados. No desenvolvimento
local, a URL deve classificar o próprio host como app. O POST exige `Origin`
exato; `Sec-Fetch-Site`, se presente, deve ser same-origin ou none. Não há
fallback por host encaminhado. O proxy já encaminha APIs do host app e recusa
essas rotas no tenant/apex; suas tabelas não mudam.

`PLATFORM_SELF_SERVICE_SIGNUP=off` continua bloqueando criação e consulta de
disponibilidade antes de acesso ao banco. Para on, o runtime exige Better Auth,
configuração de AWS KMS com identidade de workload e chaves do captcha. Isso é
verificação de configuração, sem atestar IAM, KMS, widget ou homologação real. O
manifesto jurídico externo aprovado continua obrigatório. Não se ativou flag
real nem se criaram ofertas/textos neste incremento. Status permanece disponível
ao dono assistido, independentemente da flag de cadastro.

O POST aceita apenas JSON estrito até 16 KiB efetivamente lidos, sem query;
identidade/operador não podem vir do corpo. `Idempotency-Key` é obrigatório.
Resultado 201 preserva o recibo da criação e define a preferência host-only,
HttpOnly, SameSite=Lax e Secure em HTTPS. Replays confirmados revalidam a
identidade, sem consumir nova tentativa ou repetir o captcha. Pedidos novos
consomem os limites persistidos da onda 112 antes do desafio; falha no desafio
não cria o agregado e não desfaz esse contador.

O widget futuro deverá usar a ação `onboarding` e enviar seu token por
`X-Platform-Captcha`. O adaptador chama somente o Siteverify oficial, confere
success/hostname/action, limita token a 2.048 caracteres e resposta a 8 KiB,
recusa redirect e aplica timeout de dez segundos. O UUID de validação deriva de
HMAC, vinculado ao dono/chave/host/token; só IP confiável válido segue como
remoteip. Não há retry de rede automático, log ou persistência do token. A
necessidade de validação no servidor e os limites do token estão na
[documentação oficial do Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Disponibilidade aceita uma única query `slug`, sem seletores extras. Usa o
contrato existente e devolve disponibilidade/sugestões neutras. Seu limite
persistido é 30 consultas por minuto por IP HMAC; sem IP, o contador é comum.
Estouro devolve 429 com Retry-After. Mensagens privadas de armazenamento ou
provedor são substituídas por erro neutro.

O checklist usa fatos da própria locadora, sem retornar configuração empresarial
ou identificadores privados. Equipamento cadastrado conclui FIRST_EQUIPMENT;
logo, WhatsApp ou cor primária alterada concluem CUSTOMIZE_SITE. O WhatsApp
informado na criação já satisfaz essa etapa; configuração vazia não.
PUBLISH_SITE depende de sitePublishedAt real. Recebimentos exigem conta
APPROVED, integração ACTIVE, dados comerciais vigentes e ausência de
healthIssue. SUBSCRIBE aparece somente no teste; CONFIRM_COMMERCIAL_INFO aparece
somente quando os dados estão de fato expirados. Assinatura cancelada usa o
histórico mais recente. Esse GET não publica site, ativa conta ou altera
assinatura.

## 5. Components and Files

- `packages/contracts/src/onboarding.ts`
- `packages/contracts/src/onboarding.test.ts`
- `packages/contracts/src/platform.json` (`reservedSubdomains`,
  `blockedSlugTerms`, `disposableEmailDomains`)
- `packages/contracts/src/platform.ts` e `platform.test.ts`
- `packages/backend/src/modules/onboarding/{provisioning,seeds,rate-limit,legal-publication,slug-availability,status,errors,index}.ts`
- `packages/backend/src/runtime/onboarding.ts` (configuração e pré-requisitos)
- `packages/backend/src/runtime/onboarding-captcha.ts`
- `packages/backend/src/http/onboarding.ts` e `onboarding-status.ts`
- `packages/backend/src/runtime/platform-jobs.ts` (conexão/composição)
- `tools/platform-provision-tenant.mjs`
- `tests/identity/onboarding-database.test.ts`
- `tests/unit/platform-provision-tenant.test.ts`

## 6. Data and State

- Colunas persistidas de `organizations` (S2): `documentNormalized`
  (`^[0-9A-Z]{12}[0-9]{2}$`), `legalName`, `companyType`, `phone`,
  `addressLine`, `addressNumber`, `addressComplement`, `district`; `tradeName`
  vira `Organization.name`.
- O rascunho dos passos 2 a 5 fica só no navegador; fechar a aba não cria nada.
- O cadastro não pede CPF, data de nascimento, e-mail de cobrança, faixa de
  faturamento nem dado bancário: os objetos estritos recusam essas chaves.
- As sementes escrevem somente Setting, FinancialSetting, Permission e Category
  sob o contexto novo de locadora; o papel de plataforma não pode lê-las.
  Nome/contato vêm da empresa; cores vêm dos tokens semânticos. Não se copiam
  marca, textos, scripts, imagens ou credenciais da GB.
- Auditoria guarda hash do pedido e recibo público, sem chave bruta, CNPJ,
  e-mail ou endereço duplicados. Aceites guardam IP por HMAC e user agent
  limitado.

## 7. Constraints and Edge Cases

- CNPJ: 14 posições, com ou sem a máscara `XX.XXX.XXX/XXXX-DD` (cada separador
  só na sua posição); letras só nas 12 primeiras; minúsculas viram maiúsculas;
  as letras nunca são apagadas.
- Slug na criação: só a sintaxe de `TENANT_SLUG_RE`. Reservado, bloqueado ou já
  usado responde 409 `SLUG_UNAVAILABLE`, sem dizer o motivo.
- Termo bloqueado vale como palavra inteira entre hífens: `pix-locacoes` e
  `loja-banco-do-brasil` são bloqueados; `pixel-locacoes` e
  `governador-valadares-locacoes`, não. O bloqueio vale só para slug novo e não
  muda o roteamento de locadoras existentes (`isTenantSlug`).
- E-mail descartável: domínio da lista ou subdomínio dele, sem diferenciar
  maiúsculas.
- Reservados novos: `backoffice`, `console`, `ops`, `comecar`, `planos` e
  `vincular`.
- `PLATFORM_SELF_SERVICE_SIGNUP=off` no piloto: a tela mostra "Fale com a gente"
  e o cadastro é assistido (CLI ou backoffice).

## 8. Error Handling

| Código                       | HTTP | Quando                                        |
| ---------------------------- | ---- | --------------------------------------------- |
| `INVALID_SLUG`               | 400  | Slug fora da sintaxe                          |
| `EMAIL_NOT_VERIFIED`         | 403  | E-mail do dono ainda não confirmado           |
| `SLUG_UNAVAILABLE`           | 409  | Reservado, bloqueado ou usado; com sugestões  |
| `ORGANIZATION_LIMIT_REACHED` | 409  | Dono com o máximo de organizações (3)         |
| `INVALID_CNPJ`               | 422  | Dígito verificador inválido (conferido no S1) |

`ORGANIZATION_LIMIT_REACHED` e o status 409 são definição do S0 para a regra "no
máximo 3 organizações com o usuário como dono" do ADR.

## 9. Performance and Accessibility

- Contrato puro e universal (só zod e `platform.ts`).
- As telas (S11a) passam pela revisão de acessibilidade do lote.

## 10. Tests and Validation

- `pnpm exec vitest run --config vitest.platform.config.ts packages/contracts`
- Os testes provam: CNPJ numérico e alfanumérico, com e sem máscara, minúsculas
  convertidas e rejeições de forma (T-D2); telefone, CEP e UF; declaração
  obrigatória; nenhum dado pessoal a mais; os quatro aceites obrigatórios;
  disponibilidade sem motivo; checklist na ordem, com `SUBSCRIBE` só no teste;
  status HTTP dos erros; termos bloqueados por palavra inteira; e-mail
  descartável; T1 e T2 do ADR de hosts com os novos reservados.

### Checklist no dashboard (onda 116)

O widget `packages/frontend/src/widgets/checklist-primeiros-passos` compõe a
leitura privada de `entities/onboarding` e a ação `features/publicar-site`. Web
e Expo usam os mesmos fatos e rótulos do contrato; o servidor continua
responsável por propriedade, elegibilidade, ordem e etapas opcionais. ADMIN
habilita a consulta, mas uma recusa de ownership esconde o widget. Locadoras
antigas sem assinatura também não recebem um checklist inventado.

Sem equipamento, o web oferece o cadastro existente. A publicação exige uma
confirmação com aviso de imutabilidade do endereço. Duplo clique não envia dois
pedidos; resultado incerto permite somente retry explícito do mesmo corpo vazio.
A etapa só muda depois de reler os fatos do servidor. Troca de vínculo, usuário,
locadora ou transporte descarta dados e confirmação anteriores, mesmo quando uma
resposta atrasada ignora o abort. Não há publicação automática, marcação
otimista, ativação de recebimentos ou preferência tratada como acesso.

Expo apresenta os estados e abre `/admin/dashboard` no host web configurado, com
slug como sugestão e sem transportar tokens. O app não faz o POST de publicação.
O handler de status aceita GET/HEAD autenticado direto de aparelho sem Origin,
Sec-Fetch-Site ou qualquer cabeçalho de borda. Se algum desses cabeçalhos
estiver presente, conserva a validação de borda app genuína e origem exata.
Revalidação do dono, RLS READ ONLY e resposta privada permanecem; criação,
disponibilidade e publicação continuam restritas ao host app.

O incremento não entrega o wizard de S11a nem a tela de recebimentos. Links de
equipamento, configuração e assinatura usam destinos existentes. S13,
despublicação, conta de pagamentos, backoffice e operação externa seguem
pendentes. Provas e limites na onda 116 de shared-api-host.md.

Onda 112: 196 casos distintos em sete arquivos focados (48 de provisionamento no
PostgreSQL, 57 de composição/escopo existentes, 11 da CLI, sete de publicação,
73 dos contratos/validação existentes). A execução final dirigida de quatro
casos de equipe ativa/inativa não aumenta essa contagem. Doze falhas injetadas
após gravações conferem rollback de todas as tabelas do agregado; concorrência e
índice único protegem replay, quota, slug e teste. Papéis temporários sem
BYPASSRLS comprovam isolamento, restrição de sementes e limpeza de contexto. A
CLI real é exercitada em subprocesso com banco/documentos sintéticos. Tipos,
lint, gates e builds da API/legado são evidências locais; HTTP/UI, envio real,
provedor e operação pública continuam sem homologação neste incremento.

Onda 113: 234 casos distintos em sete arquivos focados, incluindo os leitores de
assinatura existentes, adaptadores HTTP, checklist, captcha, inventário de
guardas e 52 casos PostgreSQL de onboarding. A prova integrada percorre o
handler HTTP até o agregado real e o checklist sob app_runtime sem BYPASSRLS;
confere primeira criação, cookie, replay, limites, troca de dono e limpeza do
contexto. Captcha/configuração externa são dublês nessa prova: não certificam
AWS/Cloudflare. Correção da fixture de troca de dono usa a transação autorizada,
sem relaxar o trigger. Reexecuções dirigidas não aumentam a contagem. A
evidência consolidada e os limites estão na onda 113 de shared-api-host.md.

Onda 114: 162 casos distintos em seis arquivos — 42 unitários de mensagem,
envelope, transporte e consumidor; 58 PostgreSQL de onboarding (incluindo seis
de boas-vindas); 62 de jobs de assinatura existentes. Cobrem retry após falha
local, conteúdo/chave imutáveis, transferência de dono, janela, concorrência,
recibo durável e composição real com envio simulado e signup/Asaas off. Tipos,
lint, gates e builds locais passaram. Não houve e-mail real, ativação de signup,
troca do scheduler ou homologação externa.

Onda 115: 277 casos distintos em nove arquivos, incluindo 68 no PostgreSQL de
onboarding, 81 de contratos/núcleo/HTTP/lock, 50 de rotas e regressões de
catálogo/locação e 78 do inventário de segurança. Reexecuções dirigidas não
aumentam a contagem. Provas reais de papéis restritos, auditoria atômica,
imutabilidade do slug e disputa de locks; dublês HTTP não são uma homologação de
sessão de navegador. Evidências e limites na onda 115 de shared-api-host.md.

## 11. Related Docs

- `docs/architecture/adr-saas-subscription.md`
- `docs/architecture/adr-tenant-hosts.md`
- `docs/features/tenant-slug-policy.md`
- `docs/features/assinatura-plataforma.md`

## 12. Change Log

- 2026-10-04, sem commit: assistente web /comecar, catálogo comum, rascunho
  separado por dono e retomada explícita do pedido (onda 119). Cadastro real
  off; prova de navegador usa APIs/captcha simulados. Expo conserva
  estados/link.
- 2026-09-26: Contrato do cadastro, reservados novos, termos bloqueados e
  domínios descartáveis (lote S0).
- 2026-09-26 (onda 3, commit `be859915`): validação de CPF e CNPJ alfanumérico
  em `@gb-locacoes/domain/documento` (lote S1; teste com o vetor oficial
  `12ABC34501DE35`).
- 2026-10-04, sem commit: provisionamento atômico e CLI assistida (onda 112);
  S10 parcial, sem cadastro público, consumidor de boas-vindas ou publicação.
- 2026-10-04, sem commit: HTTP autenticado, desafio de criação e checklist do
  dono nos dois hosts (onda 113). Cadastro público permanece off; UI, publicação
  e consumidor de boas-vindas ainda pendentes.
- 2026-10-04, sem commit: consumidor de boas-vindas e recibo de aceitação na
  outbox existente (onda 114), com transporte compartilhado e envio simulado nas
  provas. UI, publicação e operação externa seguem pendentes.
- 2026-10-04, sem commit: comando de publicação pelo dono nos dois hosts (onda
  115), com lock de inventário compartilhado, recibo e auditoria atômicos. UI,
  despublicação, comportamento público S13 e operação externa pendentes.
- 2026-10-04, sem commit: checklist no dashboard web/Expo e confirmação web de
  publicação (onda 116). Consulta privada direta de aparelho preserva as guardas
  de dono/RLS; wizard, recebimentos, S13 e operação externa pendentes.
- 2026-10-04, sem commit: opções de cadastro e textos aprovados por hash nos
  dois hosts (onda 117). Signup real off; wizard S11a e operação externa
  pendentes.

---

_Template version: 2026-01-20_
