> Atualização multiempresa: exemplos anteriores sem contexto são históricos. O
> serviço atual exige TenantContext como primeiro argumento; destinatários e
> administradores são memberships ativas da locadora selecionada. APIs filtram
> tenantId e userId e nunca usam User.role global para fan-out. Veja
> [modernização da área cliente](../issues/modernization-client-portal.md).

# Sistema de Notificações - GB Locações

## Avisos comerciais da plataforma (onda 95, 2026-10-03, sem commit)

Avisos de assinatura usam PlatformOutboxEvent e contatos da plataforma, em
subscriptions.notify/dunning/mail. Não são Notification de cliente nem entram na
caixa de uma locadora. Seleção de fatos e destinatários pertence a
subscriptions; communications/subscription-email.ts compõe texto/HTML escapado;
runtime injeta o transporte Resend existente com chave de idempotência.

Cada contato recebe um job privado, com elegibilidade revalidada antes do envio.
Envelope e primeira intenção são persistidos; configuração ausente mantém jobs
PENDING. Não há novo scheduler. Retry ambíguo após 23h exige conciliação, e
aceite do provedor não prova entrega final. A assinatura continua parcial;
provas, limites e pendências na onda 95 de
[API compartilhada](shared-api-host.md).

## Extração da listagem para API compartilhada (corte 20, 2026-10-02, sem commit)

Na fotografia do corte 20, `GET /api/client/notifications` foi instalado
localmente em `apps/services/api`, além do adapter legado então ativo. Esse
adapter antigo saiu em F; a API workspace permanece. As consultas e a montagem
da resposta têm uma implementação em
`packages/backend/src/modules/communications/client-notifications.ts`. O módulo
de comunicações previsto na ADR começou por essa leitura; fan-out, sync e
mutações ainda eram legados naquele corte. Naquela prova, web/mobile continuavam
na origem configurada, sem cutover.

O parser foi movido para `packages/contracts/src/notifications.ts`, sem Prisma
ou implementação de servidor. Os dois adapters de backend da época (raiz legada
e API workspace) importavam os entrypoints públicos `backend/communications` e
`contracts/notifications`. O serviço compõe o runner RLS no seu processo, sem
outro pool. O novo consumidor de contracts está declarado no package.json do
host; não foi instalada dependência externa nova.

Contrato observado da leitura:

- Principal e sua recusa precedem transação, validação e consultas. A validação
  ocorre dentro da transação, após configurar `app.tenant_id` local.
- Todos os SELECTs usam tenantId e userId do principal atual. Papel global,
  query de usuário/tenant/projeção e notificações sem tenant não ampliam acesso.
  Cada papel de membership lê somente a própria caixa.
- `page` e `limit` usam o primeiro parâmetro e `parseInt(..., 10)` antes de
  validar. Ausentes/vazios têm padrões 1/20; limite 1–100, page mínimo 1.
  Sufixos e frações são aceitos pelo parser existente; não endurecidos aqui.
- Os oito tipos são sensíveis a maiúsculas; `isRead` aceita somente as strings
  true/false; vazios não acrescentam filtro. Demais query keys são ignoradas.
- A página e seu total usam filtros. `stats.total` é esse total filtrado;
  `stats.unread` e `stats.byType` consideram todas as não lidas do destinatário
  naquela locadora, independentemente de type/isRead da página. Chaves byType em
  minúsculas, tipos sem não lidas ausentes. totalPages=0 quando total=0.
- Ordenação createdAt desc, skip/take e campos completos da Notification
  preservados, incluindo metadata, tenantId, datas e nulidade. GET não marca
  como lida nem cria notificações. Nenhum cache header foi acrescentado.
- Validação: 400 com mensagem e issues zod originais; erro inesperado: 500
  genérico, com o log sanitizado original. HEAD/OPTIONS implícitos preservados.

Proteção: `tests/unit/client-notifications-read-api.test.ts` caracteriza os dois
adapters; `tests/api-host/notifications.http.test.ts` compara builds HTTP com
cookies reais dos dois modos e papel PostgreSQL sem bypass/ownership. Os testes
anteriores de portal continuam intactos. O runtime de paridade recebe somente
SELECT na tabela de notificações. Alterar tenantId/userId nos SELECTs ou trocar
parseInt por Number derruba os novos testes, com fontes restauradas por hash.
Resultados: corte 20 de [API compartilhada](shared-api-host.md).

Na conclusão do corte 20, `/stats`, PATCH/DELETE de `[id]`, mark-all-read e sync
continuavam apenas legados, sem fallback no serviço. Este incremento não
modifica UI, fan-out, pagamento, jobs ou produção. Paridade HTTP local não
certifica Expo/browser/deploy.

## Estatísticas compartilhadas (corte 21, 2026-10-02, sem commit)

No corte 21, `GET /api/client/notifications/stats` foi montado na raiz legada e
na API workspace. Seus quatro SELECTs e a montagem da resposta pertencem a
`packages/backend/src/modules/communications/client-notification-stats.ts`. O
adapter antigo da raiz, ainda ativo naquela prova, saiu em F; a API workspace
reutiliza o principal e o runner RLS do processo. Nenhum parser, pacote,
dependência ou regra de autorização novo foi introduzido.

O DTO é `{ total, unread, byType, byPriority }`: total de toda a caixa e
agregados das não lidas, sempre por usuário/locadora do principal. Todas as
queries são ignoradas, inclusive filtros e valores inválidos da listagem. Chaves
dos mapas em minúsculas; buckets sem não lidas ficam ausentes. Caixa vazia
retorna total/unread zero e mapas vazios; caixa totalmente lida conserva o total
e esvazia os mapas. As quatro consultas continuam no mesmo Promise.all.
Principal, configuração local de RLS, status, ausência de cache/cookie,
HEAD/OPTIONS e 500 sanitizado permanecem como no legado. GET não escreve.

Caracterização anterior no legado, testes de ambos os adapters, mutações dos
filtros de tenant/destinatário e paridade HTTP com RLS e sessões reais protegem
esse contrato. Resultados e limites: corte 21 de
[API compartilhada](shared-api-host.md). Na conclusão do corte 21, PATCH/DELETE,
mark-all-read, sync, fan-out, clientes e scheduler continuavam legados; não
houve cutover.

## Marcação/exclusão compartilhadas (corte 22, 2026-10-02, sem commit)

PATCH/DELETE de `/api/client/notifications/[id]` e POST de
`/api/client/notifications/mark-all-read` foram instalados no serviço parcial no
corte 22, conservando então os adapters legados. Esses adapters antigos saíram
em F; consultas e efeitos pertencem a
`communications/client-notification-mutations.ts`; os hosts compõem principal,
guard de origem, transação RLS e transporte. O entrypoint de communications já
existente expõe funções nomeadas, sem pacote ou dependência nova.

- Principal e guard de origem precedem a transação. O guard central recusa
  navegador de outra origem antes da sessão; o guard explícito dos adapters foi
  preservado. Native sem Origin/Sec-Fetch-Site mantém o transporte anterior.
- Params de `[id]` são aguardados dentro da transação, após configurar RLS.
  FindFirst e UPDATE/DELETE usam id, tenantId e userId do principal. Sem
  registro acessível: mesmo 404 neutro, sem escrever ou revelar existência em
  outro escopo.
- PATCH sempre grava isRead=true e readAt atual, inclusive ao repetir sobre uma
  notificação já lida; retorna o DTO completo atualizado.
- DELETE retorna a mesma mensagem de sucesso; repetir dá 404. POST afeta somente
  não lidas do próprio destinatário/locadora e retorna count/mensagem originais.
  Repetir POST retorna updated=0 e conserva readAt dos registros já lidos.
- Body e query permanecem ignorados, inclusive JSON inválido e overrides de
  usuário/tenant; nenhum schema ou validação nova foi acrescentado.
- 500/log sanitizado, cache/cookies, OPTIONS e 405 preservados. Escritas e
  leituras rodam na mesma transação; falha SQL depois do write causa rollback.

Os testes HTTP restauram fixtures equivalentes entre os hosts e conferem o
estado inteiro da tabela, além dos DTOs. Datas do PATCH são verificadas contra o
relógio real e o valor persistido; somente essa diferença esperada de horário é
normalizada para comparar hosts. O runtime descartável recebe SELECT, UPDATE e
DELETE em notifications, sem INSERT, ownership ou bypass; triggers de falha são
criadas/removidas apenas no banco de teste. Evidências e limites: corte 22 de
[API compartilhada](shared-api-host.md). Na conclusão daquele corte, fan-out,
sync, pagamentos, jobs e clientes ainda eram legados. A onda 45 e os lotes
posteriores abaixo documentam sua extração; não houve mudança de produção.

## 📋 Visão Geral

O sistema de notificações da GB Locações foi projetado para manter os usuários
informados sobre eventos importantes relacionados a orçamentos, pedidos,
pagamentos, equipamentos, locações, entregas, contratos e sistema. O sistema
inclui notificações visuais no header, página dedicada na área do cliente e
**persistência real no banco de dados** via PostgreSQL.

## 🎯 Funcionalidades Principais

### 1. **Notificações do Usuário**

- **Orçamentos**: Criação, aprovação, rejeição
- **Pedidos**: Confirmação, atualizações de status
- **Pagamentos**: Boleto disponivel, confirmacao de pagamento
- **Equipamentos**: Disponibilidade, estoque baixo
- **Locações**: Início, término próximo, extensões
- **Entregas**: Agendamento, conclusão
- **Contratos**: Disponibilidade para assinatura
- **Sistema**: Manutenções, promoções

### 2. **Notificações do Carrinho**

- Contador de itens no carrinho (badge visual)
- Alertas de carrinho abandonado (após 5 minutos de inatividade)

### 3. **Interface Visual**

- Badges com contadores (estilo WhatsApp)
- Dropdown de notificações no header
- Página dedicada na área do cliente
- Animações suaves com Framer Motion
- **Bolinha azul** para indicar notificação não lida
- **Fundo laranja animado** que desaparece gradualmente ao marcar como lida
- **Badge vermelho** no sininho da sidebar indicando novas notificações

## 🏗️ Arquitetura

### Modelo de Dados (Prisma)

```prisma
model Notification {
  // Nullable while unassigned legacy records remain quarantined.
  tenantId String?
  organization Organization? @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  id         String               @id @default(cuid())
  userId     String
  type       NotificationType
  title      String
  message    String
  priority   NotificationPriority @default(MEDIUM)
  isRead     Boolean              @default(false)
  actionUrl  String?
  metadata   Json?
  createdAt  DateTime             @default(now())
  readAt     DateTime?

  @@index([userId])
  @@index([createdAt])
  @@index([type])
  @@map("notifications")
  @@index([tenantId])
  @@unique([id, tenantId])
}

enum NotificationType {
  QUOTE
  ORDER
  PAYMENT
  EQUIPMENT
  SYSTEM
  RENTAL
  DELIVERY
  CONTRACT
}

enum NotificationPriority {
  LOW
  MEDIUM
  HIGH
}
```

### APIs REST

| Endpoint                                  | Método | Descrição                    |
| :---------------------------------------- | :----- | :--------------------------- |
| `/api/client/notifications`               | GET    | Lista paginada com filtros   |
| `/api/client/notifications/[id]`          | PATCH  | Marcar como lida             |
| `/api/client/notifications/[id]`          | DELETE | Deletar notificação          |
| `/api/client/notifications/mark-all-read` | POST   | Marcar todas como lidas      |
| `/api/client/notifications/stats`         | GET    | Estatísticas de notificações |

### Query Parameters (GET /api/client/notifications)

| Parâmetro | Tipo   | Descrição                                |
| :-------- | :----- | :--------------------------------------- |
| `page`    | number | Página (default: 1)                      |
| `limit`   | number | Itens por página (default: 20, max: 100) |
| `type`    | string | Filtrar por tipo (QUOTE, ORDER, etc.)    |
| `isRead`  | string | Filtrar por status (true/false)          |

### Hooks Principais

#### `useNotifications`

```typescript
const {
  notifications, // Lista de todas as notificações
  unreadNotifications, // Notificações não lidas
  highPriorityNotifications, // Notificações de alta prioridade não lidas
  stats, // Estatísticas (total, não lidas, por tipo)
  isLoading, // Estado de carregamento
  error, // Erro, se houver
  markAsRead, // Marcar como lida
  markAllAsRead, // Marcar todas como lidas
  removeNotification, // Remover notificação
  clearAll, // Limpar todas (local)
  refresh // Recarregar da API
} = useNotifications()
```

#### `useCartNotifications`

```typescript
const {
  itemCount, // Número de itens no carrinho
  totalPrice, // Preço total
  hasItems, // Se tem itens
  items // Lista de itens
} = useCartNotifications()
```

## 🔧 Serviço de Notificações (Backend)

### Localização

- `packages/backend/src/modules/communications/admin-notifications.ts`: factory
  interna `createAdminNotificationService({ withTenantTransaction })`, que
  fornece `createAdminNotifications(context, input)` e
  `getAdminUserIds(context)`, sempre com `TenantContext`. Não é um export
  público para os hosts; `admin-alerts.ts` a compõe internamente.
- `apps/services/api/src/app/api/admin/notifications/sync/route.ts`: resolve o
  principal da locadora, exige seu papel `ADMIN` e chama `syncAdminAlerts` de
  `apps/services/api/src/host/communications.ts`, composto por
  `createAdminAlertSync` do entrypoint `@gb-locacoes/backend/communications`.
- A antiga fachada `lib/notification-service.ts` e o adapter da raiz
  `app/api/admin/notifications/sync/route.ts` saíram em F.
- `packages/backend/src/modules/rentals/client-requests.ts`: o pedido de coleta
  ou de prorrogação feito pelo cliente notifica os `ADMIN` da locadora na mesma
  transação.

### Criando notificações para a equipe da locadora

Exemplo **interno ao módulo communications**, com `withTenantTransaction`
injetado pelo composition root e `context` obtido do principal autorizado. Um
host usa a factory pública do caso de uso, não importa este arquivo interno:

```typescript
import { NotificationPriority, NotificationType } from "@prisma/client"
import { createAdminNotificationService } from "./admin-notifications"

const { createAdminNotifications } = createAdminNotificationService({
  withTenantTransaction
})
await createAdminNotifications(context, {
  type: NotificationType.QUOTE,
  title: "Orçamento pendente sem ação",
  message: "Há orçamentos pendentes há mais de 4 horas.",
  priority: NotificationPriority.HIGH,
  actionUrl: "/admin/orcamentos",
  dedupeKey: "admin:sync:quote_pending"
})
```

- Destinatários: as memberships `ADMIN` ativas da locadora (de organização
  ativa), ou só os `adminIds` informados dentre elas; nunca o `User.role`
  global.
- Dedupe dentro de `dedupeWindowMs` (padrão 6 h): com `dedupeKey`, uma
  notificação por chave e admin; sem ela, a mesma combinação de tipo, título,
  mensagem e `actionUrl`. A criação é serializada por locadora
  (`pg_advisory_xact_lock`).

### Helpers removidos (onda 9)

Os helpers por evento (`createNotification`, `createManyNotifications`,
`notifyQuoteCreated`, `notifyQuoteApproved`, `notifyPaymentReceived`,
`notifyDeliveryScheduled` e os demais `notify*`) e o `NotificationDropdown` do
header público não tinham chamador e saíram na faxina da onda 9 (entrada 225 de
`docs/issues/known-issues.md`). A versão anterior era a do commit local
histórico `4b02f52f`, no antigo `lib/notification-service.ts` (removido em F).
Ela é proveniência do arquivo preservado localmente, não comando operacional
para o repositório público de história limpa. Hoje não existe notificação ao
cliente por evento (orçamento aprovado, pagamento, entrega): quem a criar parte
de `createAdminNotifications` como modelo (contexto e transação da locadora,
dedupe) e atualiza esta seção.

## 📱 Integração no Header

### Desktop

- **Usuário logado**: atalho "Notificações" da área do cliente
  (`/area-cliente/notificacoes`), com o contador de não lidas
- **Usuário não logado**: Botão de login
- **Carrinho**: Sempre visível com contador de itens
- **Admin (desktop)**: Sininho no header admin abre dropdown de notificações
  baseado em `DropdownMenu` e `useNotifications`. No cabeçalho do dropdown, à
  esquerda do título "Notificações", um Badge exibe a quantidade de não lidas.

### Admin - Painel (Orcamentos e Locacoes)

- **Canal unico**: o dropdown do header admin concentra as notificacoes.
- **Sincronizacao ativa**: ao carregar o header admin, o sistema chama
  `/api/admin/notifications/sync` para gerar alertas criticos.
- **Foco inicial**: alertas sobre `/admin/orcamentos` e `/admin/rentals` para
  controle do negocio.
- **Dedupe**: janela de 6h evita repeticao do mesmo alerta. O sync usa
  `dedupeKey` por tipo (ex.: `admin:sync:quote_pending`) para coalescer: no
  maximo uma notificacao por tipo por admin nessa janela.

#### Alertas iniciais (Admin)

- Orcamento PENDING sem acao apos 4h.
- Orcamento aprovado sem boleto gerado/enviado apos 2h.
- Boleto enviado sem pagamento apos 24h.
- Check-in pendente apos 2h do inicio.
- Devolucao pendente e locacao em atraso.
- Contrato nao gerado em locacao ativa apos 4h.

### Mobile

- **Usuário logado**: botão de carrinho com notificações
- **Usuário não logado**: Botões de login/cadastro

### Sincronização

O contador de notificações não lidas é sincronizado entre componentes via:

1. **localStorage**: Chave `gb-locacoes-unread-count`
2. **CustomEvent**: Evento `notificationUpdate` com `detail.unreadCount`

Quando o usuario esta autenticado, o header faz uma sincronizacao inicial com
`/api/client/notifications/stats` e dispara `notificationUpdate` para garantir o
badge mesmo sem abrir `/area-cliente/notificacoes`.

```typescript
// Disparar atualização
window.dispatchEvent(
  new CustomEvent("notificationUpdate", { detail: { unreadCount: 5 } })
)

// Escutar atualização
window.addEventListener("notificationUpdate", (e) => {
  console.log("Não lidas:", e.detail.unreadCount)
})
```

## 🎨 Tipos de Notificação

### Por Categoria

- **📋 Orçamento (QUOTE)**: Relacionadas a orçamentos
- **📦 Pedido (ORDER)**: Relacionadas a pedidos
- **💳 Pagamento (PAYMENT)**: Relacionadas a pagamentos
- **🔧 Equipamento (EQUIPMENT)**: Relacionadas a equipamentos
- **📦 Locação (RENTAL)**: Relacionadas a locações
- **🚚 Entrega (DELIVERY)**: Relacionadas a entregas
- **📄 Contrato (CONTRACT)**: Relacionadas a contratos
- **🔔 Sistema (SYSTEM)**: Relacionadas ao sistema

### Por Prioridade

- **🔴 Alta (HIGH)**: Requer atenção imediata
- **🟡 Média (MEDIUM)**: Importante mas não urgente
- **🔵 Baixa (LOW)**: Informativa

## 📄 Página de Notificações

### Localização

`/area-cliente/notificacoes`: conteúdo em
`packages/frontend/src/pages/notificacoes/ui/NotificacoesPage.{web,native}.tsx`,
atrás do contrato público `@gb-locacoes/frontend/pages/notificacoes`. A rota web
vive em
`apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/notificacoes/page.tsx`.
O modelo é
`packages/frontend/src/features/notificacoes/model/use-notifications-model.ts`;
somente `use-notifications.web.ts` lê DOM/localStorage, enquanto a variante
native usa o transporte configurado pelo host. O proxy web recusa a área de
conta no modo auth `legacy`; isso não autoriza ignorar falha de carga no modelo.

### Funcionalidades

- **Lista paginada** de notificações ordenadas por data
- **Botão "Marcar todas como lidas"** (visível quando há não lidas)
- **Botão de atualizar** para recarregar da API
- **Ações por notificação**: Ver (se tiver actionUrl), Marcar como lida, Deletar
- **Loading state** com spinner
- **Error state** com botão de retry
- **Empty state** informativo

### Elementos Visuais Preservados

- **Bolinha azul**: Canto superior direito de cada notificação não lida
- **Fundo laranja animado**: Gradiente que desaparece ao marcar como lida
- **Badge vermelho no sininho**: Indica novas notificações na sidebar

## 🎭 Animações

### Framer Motion

- **Entrada**: Fade in + slide up
- **Saída**: Fade out + slide down
- **Hover**: Scale + shadow
- **Badge**: Pulse para não lidas
- **Dropdown**: Scale + opacity

### Transições

- **Duração**: 200ms para interações
- **Easing**: Suave e natural
- **Stagger**: 100ms entre itens de lista

### Animação do Fundo Laranja

```css
.transition-opacity.duration-1000.ease-in-out
```

O fundo laranja usa `opacity-100` quando não lida e `opacity-0` quando lida, com
transição de 1000ms para efeito gradual.

## ♿ Acessibilidade

### ARIA Labels

- Botões com `aria-label` descritivo
- Selects com `aria-label` para filtros
- Estados de loading anunciados

### Navegação por Teclado

- Tab navigation funcional
- Escape para fechar dropdowns
- Enter para ativar botões

### Contraste

- Cores com contraste adequado
- Estados visuais claros
- Texto legível em todos os tamanhos

## 🧪 Integração com Eventos do Sistema

Os eventos que notificam hoje são os alertas da equipe gerados por
`POST /api/admin/notifications/sync` (chamado pelo `useNotifications` quando a
sessão é de `ADMIN`) e os pedidos de coleta e prorrogação do cliente. Evento
novo pertence ao módulo do caso de uso, com `TenantContext` e transação já
autorizados. Dentro de communications, `createAdminNotifications` da factory
interna é o modelo de fan-out/dedupe; o host consome a API pública do caso de
uso, sem importar essa factory interna. O exemplo antigo com
`notifyQuoteApproved` no antigo `app/api/admin/quotes/[id]/approve/route.ts`
descrevia uma API e uma rota removidas. Efeitos de e-mail são compostos em
`apps/services/api/src/host/notification-effects.ts`; não confundir essas portas
de transporte com a caixa `Notification` do usuário.

## 📊 Métricas e Analytics

### Estatísticas Disponíveis

- Total de notificações
- Notificações não lidas
- Contagem por tipo
- Contagem por prioridade

### Eventos Rastreados

- Criação de notificação
- Leitura de notificação
- Remoção de notificação
- Ações do carrinho

## 🔮 Melhorias Futuras

### Funcionalidades Planejadas

- **Push Notifications**: Notificações do navegador
- **Email Notifications**: Notificações por email
- **Templates**: Templates personalizáveis
- **Agrupamento**: Agrupar notificações similares
- **Preferências**: Configurações de notificação por usuário
- **WebSocket**: Notificações em tempo real

### Otimizações

- **Lazy Loading**: Carregar notificações sob demanda
- **Virtual Scrolling**: Para listas grandes
- **Service Worker**: Notificações offline

## 🐛 Troubleshooting

### Problemas Comuns

#### Notificações não aparecem

- Verificar se o usuário está logado
- Verificar se a tabela `notifications` existe no banco
- Verificar console para erros de API

#### Badge não atualiza

- Verificar se o evento `notificationUpdate` está sendo disparado
- Verificar localStorage `gb-locacoes-unread-count`
- Verificar se o componente está escutando o evento

#### Performance lenta

- Verificar se há muitas notificações (use paginação)
- Verificar se as animações estão otimizadas
- Verificar índices no banco de dados

### Debug

```typescript
// Verificar notificações via API
fetch("/api/client/notifications")
  .then((r) => r.json())
  .then(console.log)

// Verificar estatísticas
fetch("/api/client/notifications/stats")
  .then((r) => r.json())
  .then(console.log)

// Verificar contador local
console.log(localStorage.getItem("gb-locacoes-unread-count"))
```

---

**Registro de 2026-10-02**: versão 2.4 (listagem, estatísticas e
marcação/exclusão no host HTTP parcial, sem cutover).

**Revisão de referências de 2026-10-09**: factories, transporte e UI canônicos
no clone pós-F, após a primeira etapa publicada em `978ceb`. O resultado dessa
primeira etapa está em `docs/guides/wave135-base-validation.md`; a rodada final
pós-F segue pendente. Persistência local e testes não homologam recebimento em
aparelho, push ou entrega externa de e-mail.

## Extração HTTP administrativa — onda 45

Em 2026-10-02, GET /api/admin/badges e POST /api/admin/notifications/sync foram
compostos em apps/services/api sobre factories únicas em backend/communications.
Contadores, nove chaves de alerta, cortes de tempo, fanout ADMIN por membership,
lock SQL e dedupe de seis horas foram preservados. Naquela onda, as antigas
fachadas `lib/notification-service.ts` e `lib/zoho-mail` ainda atendiam a raiz;
essas fachadas saíram em F. A API legada e o scheduler eram os consumidores
daquela fotografia; hoje a API workspace compõe `communications.ts` e o runner
único de jobs. A prova HTTP da onda 45 passou localmente nos dois motores.
Provas, arquivos e limites na onda 45 de
[API compartilhada](shared-api-host.md).

## Consumidor web/Expo compartilhado (onda 75, 2026-10-03)

use-notifications-model.ts é universal e usa HttpClient configurado em vez de
fetch relativo. Contexto inclui locadora, usuário/papel, sessão e transporte;
logout/troca de contexto retira os dados imediatamente e descarta respostas
anteriores. DTO, limit=50 e sync prévio somente para ADMIN global conservados.
Leitura/exclusão confirmadas atualizam o snapshot uma vez; leitura repetida não
desconta unread novamente. Refresh anterior não desfaz a mutação confirmada.

O adapter web conserva a chave gb-locacoes-unread-count e notificationUpdate. A
variante native não usa DOM/storage global e alimenta /area-cliente/notificacoes
com Card/Button/Badge e navegação do host. Erro mantém item/unread e oferece
retry. Não se anuncia caixa vazia durante falha da carga. mark-all-read conserva
POST; clearAll permanece somente local.

createNotificationHelpers era um stub sem consumidores, retornando vazio e
console.warn. Foi retirado, com suas duas exceções antigas de higiene; os
contratos HTTP e a criação real em backend/communications permanecem intactos. O
badge global de consumidores web antigos, push e recepção em aparelho continuam
dívidas. [Provas/limites da onda 75](shared-api-host.md).

## E-mail de plataforma compartilhado (onda 114, 2026-10-04, sem commit)

communications/platform-mail contém renderer e envelope de um destinatário,
reutilizados por assinatura e boas-vindas. subscriptionEmail mantém interface,
texto/HTML e validação de URL anteriores. Quem escolhe destinatário e
elegibilidade é o módulo dono: subscriptions ou onboarding. O transporte
limitado existente continua em runtime/mail; não há fallback SMTP ou branding de
locadora para essas mensagens.

onboarding.welcome congela o envelope antes do I/O, conserva a chave no retry e
registra aceitação durável. Contexto alterado ou tentativa incerta após 23 horas
exige conciliação. Os testes da composição atravessam SDK com fetch simulado;
nenhuma entrega externa foi homologada. Inbox/push e contratos de notificações
existentes não mudaram.
[Validação e limites](shared-api-host.md#onda-114--consumidor-duravel-de-boas-vindas-2026-10-04-sem-commit).
