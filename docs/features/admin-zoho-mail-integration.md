# Integração Zoho Mail no Painel Administrador

> **Status**: Fase 3 implementada (upload de anexos, busca por período, mover
> mensagens, rascunhos reais, ações rápidas e atalhos) **Última atualização**:
> 2026-01-30

---

## 1. Objetivo

Permitir que o administrador acesse, leia e gerencie os e-mails da caixa Zoho
Mail (contato@locacoesgb.com.br) diretamente no painel admin, com funções
similares ao Outlook.

**Contexto**: O projeto já envia e-mails via **Resend** (orçamentos, boleto,
contato, recuperação de senha). Os e-mails recebidos chegam no **Zoho Mail**.
Com a integração, o admin pode ler e gerenciar essa caixa sem sair do painel.

---

## 2. Funcionalidades Implementadas (MVP)

### OAuth 2.0

Na onda 60, API compartilhada e adapter antigo tinham a mesma recusa. O callback
atual da API recusa cookie cujo JSON seja null, array ou primitivo antes da
consulta de state e da troca com o provedor. Responde 307 para estado inválido e
limpa somente o cookie OAuth. State persistido e tokens existentes ficam
intactos. Correção da onda 60 (2026-10-03, sem commit), com caracterização e
provas HTTP nos dois motores de identidade; ver entrada 240 de known-issues e
docs/features/shared-api-host.md. Política de desconexão e revogação externa
continua inalterada.

- Conectar conta Zoho Mail (`/api/admin/zoho-mail/oauth/authorize`)
- Callback com persistência segura de tokens
  (`/api/admin/zoho-mail/oauth/callback`)
- Desconectar conta (`/api/admin/zoho-mail/oauth/disconnect`)
- Renovação automática de access token quando expira

### Leitura

- Listar contas Zoho do usuário (`GET /api/admin/zoho-mail/accounts`)
- Listar pastas (Inbox, Sent, Drafts, Trash, etc.)
  (`GET /api/admin/zoho-mail/folders`)
- Listar mensagens de uma pasta com paginação
  (`GET /api/admin/zoho-mail/messages`)
- Visualizar conteúdo completo de mensagem
  (`GET /api/admin/zoho-mail/messages/[id]`)

### Ações

- Arquivar mensagens (`PUT /api/admin/zoho-mail/messages/update` com
  `action: 'archive'`)
- Excluir mensagens (`DELETE /api/admin/zoho-mail/messages/[id]/delete`)
- Marcar como lido/não lido (via rota `/update`)
- Destacar/remover estrela (via rota `/update`)
- **Denunciar spam** (`PUT /api/admin/zoho-mail/messages/update` com
  `action: 'spam'`) — move mensagem para pasta Spam e treina filtro Zoho. Antes
  de executar, é exibida uma dialog de confirmação (igual à da lixeira).
- **Marcar como não spam** (`PUT /api/admin/zoho-mail/messages/update` com
  `action: 'notspam'`) — remove da pasta Spam e volta para Caixa de entrada

**Comportamento do sistema de spam:** As mensagens marcadas como spam são
realmente movidas para a pasta **Spam** da conta Zoho Mail do projeto (visível
na sidebar em "Spam"). O Zoho usa essa ação para treinar o filtro: futuros
e-mails do mesmo remetente podem ser classificados automaticamente como spam
pelo Zoho. Ou seja, sim, as mensagens vão para a sessão Spam do projeto e são
efetivamente marcadas como spam no servidor.

### Envio e Composer

- Enviar novo e-mail (`POST /api/admin/zoho-mail/messages/send`)
- Responder (`POST /api/admin/zoho-mail/messages/[messageId]/reply` com
  `action: 'Reply'`)
- Encaminhar (composer com assunto "Fwd:" e corpo citado; envia via `/send`)
- Composer: De (somente leitura), Para, Cc, Bcc, Assunto, Mensagem

### Anexos

- Download de anexo
  (`GET /api/admin/zoho-mail/messages/[messageId]/attachments/[attachmentId]`)
- Upload de anexos no composer (`POST /api/admin/zoho-mail/attachments/upload`)

### Rascunhos

- Na pasta Rascunhos, botão "Editar e enviar" abre o composer com o conteúdo do
  rascunho; envio via POST send.
- Salvar rascunho manual e auto-save no composer (persistido em Rascunhos)
  (`POST /api/admin/zoho-mail/messages/drafts`)

### Busca e Filtros

- Busca por remetente, assunto ou resumo (filtro client-side na lista)
- Busca por período (filtro de data no painel)
- Filtros rápidos: Todas, Não lidas, Destacadas, Com anexos

### Ações em Massa

- Modo seleção na lista (botão "Selecionar"); checkboxes por mensagem
- Arquivar, Excluir, Marcar como lido em lote
- Mover para pasta em lote
- **Denunciar spam em lote** (botão "Spam" — visível fora da pasta Spam)
- **Marcar como não spam em lote** (botão "Não é spam" — visível na pasta Spam)

### Produtividade

- Atalhos de teclado (j/k, r, f, e, /, ?)
- Ações rápidas na lista (marcar lido, arquivar, excluir)
- Mover para pasta no visualizador

### Interface

- Item "E-mail" no sidebar admin
- Página `/admin/email` com layout responsivo:
  - Desktop XL+: 3 colunas (pastas | lista de mensagens | visualizador)
  - Desktop/Tablet: 2 colunas (pastas+lista | visualizador oculto)
  - Mobile: navegação por etapas
- Componentes: `EmailFolderList`, `EmailMessageList`, `EmailViewer`
- Badges de não lidas, anexos, destacados
- Formatação de datas relativas (ex.: "há 2 horas")
- **Pastas normalizadas na sidebar**: nomes traduzidos para português (Caixa de
  entrada, Enviados, Rascunhos, Spam, Arquivado, Modelos, Lixeira, Recibos),
  ordem: Caixa de entrada → Enviados → Rascunhos → Spam → Arquivado → Modelos →
  Lixeira; pastas ocultas: Outbox, Newsletter, Notification, Snoozed
  (`packages/frontend/src/features/correio/model/caixa.ts` — `normalizeFolders`,
  consumido pelo modelo da página email-admin)
- **Sanitização HTML**: Conteúdo de e-mail sanitizado com DOMPurify
  (`packages/frontend/src/shared/lib/sanitize.web.ts`) antes de exibir no
  viewer; o contrato de plataforma seleciona a variante própria.
- **Mover para pasta**: disponível no visualizador e no modo seleção
- **Atalhos**: dialog com lista de atalhos e hotkeys ativos

---

## 3. Funcionalidades Planejadas (Futuro)

- **Modo de leitura**: foco total no conteúdo
- **Ordenação avançada**: por remetente/assunto/data
- **Atalhos adicionais**: navegação estendida e ações em massa via teclado

---

## 4. Arquitetura Técnica

### Backend, contratos e composição atual

- `packages/backend/src/modules/communications/zoho-constants.ts`: URLs base e
  escopos OAuth.
- `packages/contracts/src/zoho-mail.ts`: DTOs públicos de conta, pasta, mensagem
  e anexos, sem tokens de servidor no cliente.
- `packages/backend/src/modules/communications/zoho-client.ts`:
  `createZohoMailClient`, operações OAuth e `makeZohoMailRequest`.
- `packages/backend/src/modules/communications/zoho-tokens.ts`:
  `createZohoMailTokenReader`; consulta/renova a chave composta tenant/user e
  recusa datacenter incompatível.
- `apps/services/api/src/host/zoho-oauth.ts`: composição OAuth do processo.
- `apps/services/api/src/app/api/admin/zoho-mail`: adaptadores HTTP; acesso
  privado exige o principal da locadora e a permissão do módulo.
- `packages/frontend/src/pages/email-admin`: modelos compartilhados e
  apresentações web/native; o host monta a entrada pública da slice.

As fachadas antigas de Zoho da raiz foram retiradas em F. Os hosts web e API do
workspace continuam; nenhum token ou cliente servidor entra no bundle de UI.

### Modelo de Dados (Prisma)

```prisma
model ZohoMailToken {
  id           String   @id @default(cuid())
  tenantId     String?
  userId       String
  accessToken  String   @db.Text
  refreshToken String   @db.Text
  expiresAt    DateTime
  accountId    String?
  datacenter   String   @default("com")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([tenantId, userId])
}
```

### API Routes

- **OAuth**: `/api/admin/zoho-mail/oauth/{authorize,callback,disconnect}`
- **Contas**: `/api/admin/zoho-mail/accounts`
- **Pastas**: `/api/admin/zoho-mail/folders?accountId=xxx`
- **Mensagens**:
  - Listar:
    `/api/admin/zoho-mail/messages?accountId=xxx&folderId=xxx&limit=50&start=0`
  - Visualizar: `/api/admin/zoho-mail/messages/[id]?accountId=xxx&folderId=xxx`
  - Atualizar: `/api/admin/zoho-mail/messages/update` (PUT com
    `{ messageIds, action }`)
  - Rascunhos: `/api/admin/zoho-mail/messages/drafts` (POST)
  - Upload anexos: `/api/admin/zoho-mail/attachments/upload` (POST)
  - Excluir:
    `/api/admin/zoho-mail/messages/[id]/delete?accountId=xxx&folderId=xxx&expunge=true`

### Segurança

- Middleware `requireAdminOrOperator` em todas as rotas
- Tokens armazenados no banco PostgreSQL (access + refresh)
- Estado OAuth (`state`) em cookie httpOnly para proteção CSRF
- Renovação automática de access token via refresh (transparente ao front)

---

## 5. Como Usar

1. **Conectar**: Admin faz login → vai para `/admin/email` → clica "Conectar
   Zoho Mail" → autoriza no Zoho → volta para o painel conectado
2. **Navegar**: Pastas aparecem à esquerda (Inbox, Sent, etc.); clicar em uma
   pasta carrega as mensagens
3. **Ler**: Clicar em uma mensagem na lista (coluna do meio) exibe o conteúdo à
   direita (desktop XL+)
4. **Arquivar/Excluir**: Botões no visualizador (coluna da direita)
5. **Desconectar**: Botão abaixo da lista de pastas

---

## 6. Configuração OAuth e Redirect URI

### Variáveis obrigatórias

Para o botão "Conectar Zoho Mail" funcionar, é necessário configurar no `.env`:

- **`ZOHO_CLIENT_ID`** — Client ID do app no
  [Zoho API Console](https://api-console.zoho.com/)
- **`ZOHO_CLIENT_SECRET`** — Client Secret do mesmo app

Opcional:

- **`ZOHO_REDIRECT_URI`** — URI de callback (se não definido, usa
  `NEXTAUTH_URL` + `/api/admin/zoho-mail/oauth/callback`)

Se `ZOHO_CLIENT_ID` não estiver definido, ao clicar em "Conectar Zoho Mail" o
app redireciona de volta para `/admin/email` com uma mensagem de erro em toast:
"Zoho Mail não está configurado. Configure ZOHO_CLIENT_ID e ZOHO_CLIENT_SECRET
no arquivo .env." (em vez de retornar 500 e a página genérica "This page isn't
working").

### Erro "URI de redirecionamento inválido"

Se, ao clicar em "Conectar Zoho Mail", o Zoho exibir **"URI de redirecionamento
inválido"** ou **"O URI de redirecionamento passado não corresponde ao
configurado"**, o redirect URI enviado pelo app não coincide com o registrado no
[Zoho API Console](https://api-console.zoho.com/) (Client Details → Redirect
URI).

O app monta o redirect URI assim:

- Se existir a variável de ambiente **`ZOHO_REDIRECT_URI`**, ela é usada
  (recomendado em produção para evitar divergência com o NEXTAUTH_URL).
- Caso contrário, usa **`NEXTAUTH_URL`** +
  `/api/admin/zoho-mail/oauth/callback`.

**O que fazer:**

1. **No Zoho API Console** Em "Redirect URI", cadastre **exatamente** a URL que
   o app envia. Exemplos:
   - Com `www`:
     `https://www.locacoesgb.com.br/api/admin/zoho-mail/oauth/callback`
   - Sem `www`: `https://locacoesgb.com.br/api/admin/zoho-mail/oauth/callback` A
     URL que aparece na barra do navegador na tela de erro do Zoho é a que está
     sendo enviada; use essa mesma URL (parâmetro `redirect_uri` decodificado)
     no Zoho.

2. **Ou ajustar o app** Se no Zoho você já tiver apenas uma das URLs (por ex.
   sem `www`) e em produção o `NEXTAUTH_URL` for a outra (com `www`), defina no
   ambiente de produção:
   ```env
   ZOHO_REDIRECT_URI="https://locacoesgb.com.br/api/admin/zoho-mail/oauth/callback"
   ```
   (troque pelo domínio exato que está registrado no Zoho). Assim o app passará
   a enviar esse URI e o erro de redirect deixa de ocorrer.

### Plataforma multi-host (onda 3, commit `be859915`)

Com a plataforma por host configurada (ambiente válido e `PLATFORM_EDGE_SECRET`
definido), `getZohoRedirectUri` (no arquivo antigo `lib/zoho-mail/client.ts`,
retirado em F) usava o callback abaixo. O mesmo contrato está hoje dentro de
`createZohoMailClient`, em
`packages/backend/src/modules/communications/zoho-client.ts`, e usa sempre o
callback fixo do painel:
`https://app.<raiz>/api/admin/zoho-mail/oauth/callback`. `ZOHO_REDIRECT_URI`
deve ficar vazia ou igual a essa URL; valor diferente gera erro. Só esse
endereço precisa estar cadastrado no Zoho. O callback volta ao painel com
`Location` relativo (`/admin/email?...`), sem `NEXTAUTH_URL`, e o `state`
continua preso à locadora e ao usuário. Sem a plataforma multi-host, vale o
comportamento acima. Teste: `tests/identity/zoho-oauth.test.ts`.

---

## 7. Estrutura da Resposta do Zoho

### `/accounts`

```json
{
  "status": { "code": 200, "description": "success" },
  "data": [
    {
      "accountId": "8834132000000008002",
      "primaryEmailAddress": "contato@locacoesgb.com.br",
      "displayName": "GB Locações",
      ...
    }
  ]
}
```

### `/folders` (formato esperado, ajustar se diferir)

```json
{
  "status": { "code": 200 },
  "data": [
    {
      "folderId": "...",
      "folderName": "Inbox",
      "unreadCount": 5,
      "totalCount": 120
    }
  ]
}
```

### `/messages/view` (formato esperado)

```json
{
  "status": { "code": 200 },
  "data": [
    {
      "messageId": "...",
      "subject": "Re: Orçamento",
      "fromAddress": {
        "emailAddress": "cliente@email.com",
        "displayName": "Cliente"
      },
      "receivedTime": 1769191995000,
      "isRead": false,
      "hasAttachments": true,
      "summary": "Gostaria de..."
    }
  ]
}
```

---

## 8. Avisos de Segurança

### XSS em E-mails HTML

O componente `EmailViewer` usa `dangerouslySetInnerHTML` para exibir conteúdo
HTML. **Isso é um risco de XSS** se e-mails maliciosos contiverem scripts.

**Recomendação para Produção**:

1. Instalar DOMPurify: `pnpm add isomorphic-dompurify`
2. Sanitizar antes de exibir:

   ```tsx
   import DOMPurify from "isomorphic-dompurify"

   const sanitized = DOMPurify.sanitize(message.htmlContent || "", {
     ALLOWED_TAGS: [
       "p",
       "div",
       "span",
       "a",
       "img",
       "br",
       "b",
       "i",
       "u",
       "strong",
       "em"
     ],
     ALLOWED_ATTR: ["href", "src", "alt", "class", "style"]
   })
   ```

3. Aplicar em `EmailViewer` antes de usar `dangerouslySetInnerHTML`

---

## 9. Documentos Relacionados

- `docs/features/admin-system.md` — padrões do painel admin
- `docs/features/quote-email-system.md` — envio atual (Resend)
- [Zoho Mail API](https://www.zoho.com/mail/help/api/)
- [Zoho OAuth 2.0](https://www.zoho.com/mail/help/api/using-oauth-2.html)

---

## 10. Histórico

- 2026-09-26 (onda 3, commit `be859915`): redirect fixo no host `app.` da
  plataforma multi-host e retorno relativo ao painel (Lote 6 da ADR de hosts).
- 2026-02-02: **Sistema de Spam implementado**: Botões "Denunciar spam" e "Não é
  spam" no visualizador e em ações em massa. API suporta actions `spam` e
  `notspam` que usam os endpoints Zoho `moveToSpam` e `markNotSpam` para treinar
  o filtro de spam.
- 2026-01-21: **MVP implementado**: OAuth completo, listar
  contas/pastas/mensagens, visualizar conteúdo, arquivar e excluir. Layout 3
  colunas responsivo. Componentes `EmailFolderList`, `EmailMessageList`,
  `EmailViewer`. Rotas: `/oauth/*`, `/accounts`, `/folders`, `/messages`,
  `/messages/[id]`, `/messages/update`, `/messages/[id]/delete`.
- 2026-01-30: **Fase 3**: Upload de anexos, busca por período, mover mensagens,
  rascunhos reais com auto-save, ações rápidas e atalhos de teclado.
- 2026-01-20: Criação do documento de viabilidade.

---

_Última atualização: 2026-10-02 (onda 48, sem commit)_

## Extração compartilhada — onda 46 (2026-10-02, sem commit)

As seis operações de leitura agora têm adapters no legado e em
apps/services/api, sobre factories únicas de backend/http. Cliente OAuth/fetch,
configuração, token e normalizador de remetente ficam em backend/communications;
somente as leituras foram compostas nesta onda.

A chave de token é tenantId/userId, sob FORCE RLS; o exemplo histórico acima não
indica mais userId globalmente único. Linhas sem tenantId permanecem em
quarentena. Contas retornam o conjunto do provedor; pastas/mensagens/downloads
exigem accountId armazenado para o usuário na locadora atual. O datacenter é
validado antes de usar o accessToken. Refresh conserva a atualização por chave
composta. OAuth autoriza/callback/desconecta, mutações e frontend ainda usam a
composição legada; o consumidor continua sanitizando HTML.

Provas: 52 casos de caracterização, 32 HTTP em cada motor, 19 de regressão dos
alertas em NextAuth, seis OAuth e inventário 73/73. Provedor apenas local,
cookies reais e PostgreSQL com role sem BYPASSRLS. Sem caixa real, alteração de
URLs, dependências, scheduler, publicação ou cutover. Detalhes/limites:
[onda 46 da API compartilhada](shared-api-host.md).

## Extração compartilhada — onda 47 (2026-10-02, sem commit)

Send/reply/draft/update/delete/upload estão compostos nos dois hosts sobre
adapters únicos de backend/http. Schemas em contracts/zoho-mail; sanitização,
transporte e token em backend/communications; logger em runtime. Fachadas
legadas e clientes continuam ativos. IDs longos, multipart attach, limites,
status, auditoria e tenancy preservados.

Cache continua por processo, TTL cinco minutos; reply mantém a chave sem o
messageId concreto. Envio/cache precedem auditoria aguardada, inclusive o 500
após envio se a auditoria falhar. Listas opcionais requerem string vazia no
input quando não usadas. Esses limites antigos foram documentados e
caracterizados; este corte não altera comportamento.

Caracterização 59/59 antes, 149/149 unitários, HTTP 50 escritas e 32 leituras
por motor (erro da fixture NextAuth corrigido no único caso afetado; Better Auth
82/82 completos), OAuth 6/6, inventário 73/73 e gates 183/183. Provedor
estritamente local; sem caixa real, cutover ou scheduler novo. Detalhes:
[onda 47 da API compartilhada](shared-api-host.md).

## Extração compartilhada — onda 48 (2026-10-02, sem commit)

Authorize/callback/disconnect também estão compostos nos dois hosts sobre
factories únicas em backend/http. Headers/guard e cookies Next ficam nos hosts;
cliente OAuth e token ficam no backend. O callback público permanece fixo no app
da plataforma e a volta ao painel é 307 relativa. Clientes/proxy/scheduler
continuam configurados para o legado.

Nonce aleatório, SHA256 no banco, cookie HttpOnly/lax/Secure em produção,
validade de dez minutos, vínculo tenant/user e consumo anterior à troca do
código foram preservados. A recusa interna do principal inclui o mesmo texto do
JSON para permitir redirect sem ler a Response no caminho de recusa. Não houve
alteração de autorização ou de resposta HTTP. Erro do provedor e falta de código
continuam anteriores ao erro de sessão.

Desconexão continua apenas local: não revoga no Zoho nem cancela state pendente.
Essa dívida e o caso de cookie JSON null estão registrados na entrada 240 de
known-issues. Descoberta de accountId conserva melhor esforço; tokens/expiry e
chave composta permanecem os mesmos.

Provas: 26 caracterizações antes, 254 unitários consolidados, sete comparações
AST, OAuth HTTP 27/27 por motor nos dois hosts, regressão NextAuth 82/82,
identidade 6/6, inventário 73/73 e gates 183/183. Provedor apenas loopback,
cookies reais e PostgreSQL com FORCE RLS/role sem BYPASSRLS; sem conta real,
cutover ou produção. Detalhes e limites:
[onda 48 da API compartilhada](shared-api-host.md).

## Transporte compartilhado (onda 70, 2026-10-03, sem commit)

Leituras/ações, composição de mensagem, rascunhos, upload e download usam o
HttpClient configurado e adapter privado da página email-admin. Corpo completo é
consumido no ciclo capturado. Troca de pasta/seleção/transporte/identidade ou
fechamento do compositor descarta continuação antiga; um lote não inicia a
próxima exclusão quando o ciclo encerra. ID de rascunho novo preserva digitação.

OAuth continua navegando por /api/admin/zoho-mail/oauth/authorize no host web,
preservando proxy/cookies. Políticas otimistas/rollback, HTML e idempotência
permanecem; abort não desfaz envio/exclusão recebidos pelo servidor. Tipagem
mais específica dos DTOs e decomposição do modelo são dívida própria. Provas
locais, sem chamar Zoho real: [onda 70](shared-api-host.md). Aceite interativo
pendente.

## Expo — portas de aparelho (onda 84, 2026-10-03, sem commit)

O consumidor nativo usa os mesmos controladores/API/validações de mail,
rascunho, anexos e envio. O host só fornece files multipart, UUID, storage,
renderização HTML e compartilhamento de bytes já autenticados. Sem segredo do
Zoho no app. OAuth continua pelo painel web autenticado configurado em
EXPO_PUBLIC_WEB_URL; nenhum bearer entra na URL. Fechamento do navegador
consulta accounts novamente, sem afirmar conexão. Handoff OAuth nativo direto,
provedor real, WebView e arquivos em aparelho permanecem pendentes.
[Provas e fronteiras](shared-api-host.md), onda 84.

## Admissão durável — onda 102 (2026-10-04, sem commit)

As seis mutações externas agora compartilham admissão durável em backend,
ativada somente no modo on. Modos off/shadow e leitura/refresh conservam o fluxo
vigente. Repetição exige chave estável; resultado incerto não é reenviado. 358
casos passaram, 55 novos. Reconciliação/OAuth e aceite real permanecem
pendentes. Fiscalização real off e legado ativo.
[Fronteira e limites](../architecture/zoho-command-admission.md).

## Origem explícita — onda 103 (2026-10-04, sem commit)

Leituras da caixa privada e authorize/callback OAuth verificam Origin quando
esse cabeçalho está presente. Origem irmã é recusada antes de token/transport ou
cookie/state/exchange. Navegação OAuth sem Origin continua permitida pelo fluxo
existente de state de uso único e binding de cookie/usuário/locadora. Essa
verificação é comum aos dois hosts e não altera a regra geral de GET/HEAD. Os
116 casos HTTP ampliados passaram, incluindo as oito recusas antes falhas;
aceite real de OAuth e reconciliação externa continuam pendentes.
[Validação e limites](shared-api-host.md).
