# Interface de WhatsApp no Painel Admin – UI/UX

> **Status**: Implementado **Última atualização**: 2026-02-02

Continuidade local de 2026-10-08, sem commit: os painéis conservam os mínimos de
600px de altura e 200px de largura e o máximo de 280px de largura, com os nomes
anteriores dos utilitários. A troca por escala rem alterava essas medidas com
fonte do navegador em 20px; foi desfeita. A quebra de palavras também voltou ao
nome já coberto pela fixture de produção. Paridade de estilos 27/27; a captura
de produção atual ainda será conferida. Nenhum fluxo Meta, conteúdo, token ou
baseline mudou. Ver entrada 333 de known-issues.

---

## 1. Purpose

Implementar uma interface no painel administrativo (`/admin/whatsapp`) para
acompanhar e responder mensagens de clientes via Meta WhatsApp Cloud API, com
layout inspirado no e-mail: lista de conversas, lista de mensagens da conversa
selecionada e preview com ações Responder e Expandir.

**Objetivos**:

- Lista de conversas ordenada por última mensagem
- Lista de mensagens da conversa (bolhas in/out)
- Preview da thread com botão Responder e Expandir
- Dialog de visualização completa da conversa
- Dialog de composição (responder) com campo de texto e enviar
- Persistência de mensagens no banco (Prisma) para histórico

---

## 2. Scope

**In scope**

- Layout com painéis ajustáveis (conversas, mensagens, preview)
- Persistência de preferências de largura (localStorage: `whatsapp-panel-sizes`)
- Webhook Meta (GET verificação, POST mensagens/status) em rota pública
- APIs admin: listar conversas, listar/enviar mensagens por conversa
- Envio de texto via Meta Graph API e persistência local

**Out of scope (primeira fase)**

- Mídia (imagem, áudio, vídeo, documento): exibição/envio em fase posterior
- Pastas ou etiquetas (WhatsApp não tem pastas como e-mail)

---

## 3. Entry Points

- **Route**: `apps/clients/web/src/app/(admin)/admin/whatsapp/page.tsx`, host
  fino que consome `AdminWhatsAppPage` da entrada pública
  `@gb-locacoes/frontend/pages/whatsapp-admin`.
- **Componentes**:
  - `packages/frontend/src/pages/whatsapp-admin/ui/Layout.web.tsx` – Container
    principal com ResizablePanelGroup (mensagens | preview)
  - `packages/frontend/src/pages/whatsapp-admin/ui/ListaConversas.web.tsx` –
    Lista de conversas
  - `packages/frontend/src/pages/whatsapp-admin/ui/ListaMensagens.web.tsx` –
    Lista de mensagens da conversa (bolhas in/out)
  - `packages/frontend/src/pages/whatsapp-admin/ui/Visualizador.web.tsx` –
    Preview da thread com Responder e Expandir
  - `packages/frontend/src/pages/whatsapp-admin/ui/DialogoCompleto.web.tsx` –
    Dialog de visualização completa
  - `packages/frontend/src/pages/whatsapp-admin/ui/DialogoCompositor.web.tsx` –
    Dialog para responder (texto + enviar)

---

## 4. Core Flow

1. **Usuário acessa `/admin/whatsapp`**
   - Sistema carrega conversas (GET `/api/admin/whatsapp/conversations`).
   - Se não houver conversas, exibe mensagem orientando que mensagens recebidas
     via webhook aparecerão ali.

2. **Seleção de conversa**
   - Usuário clica em uma conversa na lista.
   - Sistema carrega mensagens da conversa (GET
     `/api/admin/whatsapp/conversations/[id]/messages`).
   - Lista de mensagens e preview são atualizados.

3. **Responder**
   - Usuário clica em "Responder" no preview ou na dialog de visualização
     completa.
   - Abre dialog de composição (texto + Enviar).
   - Ao enviar, POST `/api/admin/whatsapp/conversations/[id]/messages` com
     `{ text }`; mensagem é enviada via Meta API e persistida no Prisma; lista e
     preview são atualizados.

4. **Expandir**
   - Usuário clica em "Expandir" no preview.
   - Dialog de visualização completa abre com a mesma thread; pode responder a
     partir dela.

5. **Webhook (Meta)**
   - GET `/api/webhooks/whatsapp/[integrationId]`: verificação com
     `hub.verify_token` e `hub.challenge` (não remover).
   - POST `/api/webhooks/whatsapp/[integrationId]`: assinatura HMAC do corpo
     bruto, mensagens e status são parseados e persistidos (conversa + mensagem
     INBOUND ou atualização de status).

---

## 5. APIs e Backend

### Extração incremental das leituras (2026-10-02)

No corte de 2026-10-02, os três GETs abaixo eram compostos no adapter antigo e
na API compartilhada. Após F, o dono HTTP é `apps/services/api`, com leitura em
`apps/services/api/src/host/whatsapp-read.ts`. Consultas, DTOs, contagem e
ordenação pertencem a
`packages/backend/src/modules/communications/whatsapp-read.ts`; query,
parâmetros e respostas são adaptados por `backend/http/whatsapp-read.ts`. Ambos
usam o vínculo ativo ADMIN/OPERATOR e transações por locadora sob FORCE RLS.
Listagem usa limite/offset e busca insensível a caixa; thread conserva cursor
timestamp estrito e devolve cada página em ordem cronológica.

Na onda50, envio POST e webhooks passaram a coexistir nos dois adapters, sem
troca de origem naquele corte ou mudança da fase de texto. Hoje a composição é
`apps/services/api/src/host/whatsapp-write.ts` e `payment-webhooks.ts`; o host
web encaminha para a API configurada. Resultados, limites e estado do serviço
parcial na [API compartilhada](shared-api-host.md).

- **Webhook**: GET/POST `/api/webhooks/whatsapp/[integrationId]` no host API,
  autenticados pela integração ativa. A URL sem integração permanece 410.
- **Admin**:
  - GET `/api/admin/whatsapp/conversations` – listar conversas (limit, offset,
    search).
  - GET `/api/admin/whatsapp/conversations/[conversationId]` – detalhe da
    conversa.
  - GET `/api/admin/whatsapp/conversations/[conversationId]/messages` – listar
    mensagens (limit, before como cursor).
  - POST `/api/admin/whatsapp/conversations/[conversationId]/messages` – enviar
    mensagem de texto (body: `{ text: string }`).

- **Backend compartilhado**: communications/whatsapp-client.ts contém envio e
  parsers; whatsapp-webhook.ts contém a persistência do evento. O adapter
  http/whatsapp-send.ts preserva as validações e os envelopes existentes. As
  fachadas antigas `lib/meta-whatsapp.ts` e
  `lib/security/webhook-consumers/whatsapp.ts` foram retiradas em F; envio e
  consumo do webhook são compostos por `whatsapp-write.ts` do host API.
  Integração exige ADMIN; envio pela conversa permite ADMIN/OPERATOR, sempre
  pelo vínculo ativo da locadora.
- Envio persiste OUTBOUND/processing antes da chamada Graph v21.0. Confirmação
  com id do provedor muda para sent; falha ou resposta sem id conserva unknown,
  sem fingir entrega ou repetir automaticamente. Inbox/outbox deduplicam eventos
  e preservam retry. Concorrência pode responder 503 transitório (entrada 241).

---

## 6. Variáveis de Ambiente

- TenantIntegration guarda provider WHATSAPP, externalAccountId (ID numérico do
  telefone) e credentialsRef. A referência `env:LOCADORA_INTEGRATION_<NOME>`
  resolve as variáveis com sufixos `_API_KEY`, `_SECRET` e `_VERIFY_TOKEN` da
  locadora. Nenhum fallback global de conta ou token é usado pelo envio.
- `_SECRET` autentica a assinatura `sha256=` do corpo bruto; `_VERIFY_TOKEN`
  valida hub.verify_token no GET. O webhook específico precisa ser acessível
  pela Meta via HTTPS. Credenciais reais e entrega externa não foram
  certificadas pela fixture local da onda 50; a URL pública ainda aponta ao
  legado.

---

## 7. Regras para IAs / Code Review

- Não remover a verificação GET do webhook (`hub.mode`, `hub.verify_token`,
  `hub.challenge`); a Meta exige para validar a URL.
- Não remover a persistência de mensagens no POST do webhook; a listagem no
  painel depende dos dados no Prisma (a Meta não oferece endpoint de listagem de
  mensagens).
- Manter a chave de localStorage distinta (`whatsapp-panel-sizes`) para não
  conflitar com o e-mail.

## Transporte compartilhado (onda 70, 2026-10-03, sem commit)

Conversas/mensagens/envio usam HttpClient configurado, preservando limite 50,
offset/before, normalização e texto aparado. Query de mensagens relativa corrige
a construção anterior de URL sem base. Troca de conversa/usuário/ transporte ou
fechamento do compositor não aplica resultado/feedback antigo. O backend,
webhook e identidade visual permanecem intactos. Abort não desfaz mensagem
enviada. Provas locais: [onda 70](shared-api-host.md); aceite em
navegador/aparelho e provedor real continua pendente.

## Consumidor Expo — onda 84 (2026-10-03, sem commit)

Native monta conversas, mensagens anteriores, expansão e resposta de texto sobre
o modelo/adapter comum. Limite 50/offset/before, payload aparado, escopo,
recusas e apresentação web permanecem. Página reinicia também pelo status da
organização. Nenhuma nova regra ou suporte de envio de mídia inventado. O
compositor conserva fechamento/limpeza observados inclusive após recusa; não há
sucesso falso. Provas: [onda 84](shared-api-host.md). Layout, teclado, gestos,
aparelho e entrega Meta continuam pendentes.
