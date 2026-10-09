# Interface de Email no Painel Admin - UI/UX Estilo Outlook

> **Status**: Implementado **Última atualização**: 2026-02-02

---

## 1. Purpose

Implementar uma interface de email moderna e intuitiva no painel administrativo
(`/admin/email`) inspirada no Outlook, com layout unificado, Preview Pane
ajustável e opção de expandir mensagens para visualização completa.

**Objetivos**:

- Layout unificado em um único bloco (não separado em cards)
- Preview Pane ajustável lateralmente (resizable)
- Opção de expandir mensagem completa em modal/dialog
- Layout responsivo que se adapta a diferentes tamanhos de tela
- Persistência de preferências de largura dos painéis

---

## 2. Scope

**In scope**

- Layout unificado com painéis ajustáveis (pastas, lista, preview)
- Preview Pane com ajuste lateral via drag handles
- Dialog de visualização completa da mensagem
- Responsividade para mobile/tablet/desktop
- Persistência de preferências de largura (localStorage)
- Feedback visual e acessibilidade (cursors, ARIA labels, keyboard nav)
- Busca por período na lista de mensagens
- Filtros rápidos e ações em massa
- Ações rápidas na lista (hover)
- Atalhos de teclado essenciais

**Out of scope**

- Modo de leitura (ocultar elementos não essenciais) (Fase 2)

---

## 3. Entry Points

- **Route**: `/admin/email`, em
  `apps/clients/web/src/app/(admin)/admin/email/page.tsx`; o host consome
  `AdminEmailPage` por `@gb-locacoes/frontend/pages/email-admin`.
- **Componentes**:
  - `packages/frontend/src/pages/email-admin/ui/email-layout-container.web.tsx` -
    Container principal unificado
  - `packages/frontend/src/pages/email-admin/ui/email-viewer.web.tsx` -
    Visualizador de mensagem (modificado)
  - `packages/frontend/src/pages/email-admin/ui/email-full-view-dialog.web.tsx` -
    Dialog de visualização completa
  - `packages/frontend/src/pages/email-admin/ui/email-composer-dialog.web.tsx` -
    Compositor de mensagem
  - `packages/frontend/src/pages/email-admin/ui/email-folder-list.web.tsx` -
    Lista de pastas
  - `packages/frontend/src/pages/email-admin/ui/email-message-list.web.tsx` -
    Lista de mensagens

---

## 4. Core Flow

1. **Usuário acessa** `/admin/email`

- Sistema verifica conexão Zoho Mail
- Se não conectado, exibe card de conexão
- Se conectado, carrega pastas e mensagens

2. **Navegação em Pastas**

- Usuário seleciona uma pasta (Inbox, Sent, etc.)
- Sistema carrega mensagens da pasta selecionada
- Lista de mensagens é atualizada

3. **Seleção de Mensagem**

- Usuário clica em uma mensagem na lista
- Preview Pane exibe o conteúdo da mensagem
- Em mobile, Sheet lateral abre com a mensagem

4. **Ajuste de Layout (Desktop)**

- Usuário arrasta handles entre painéis
- Larguras são ajustadas em tempo real
- Preferências são salvas automaticamente

5. **Expansão de Mensagem**

- Usuário clica em "Expandir" no Preview Pane
- Dialog fullscreen abre com a mensagem completa
- Corpo da mensagem com wrap (quebra de linha) para leitura linear, sem scroll
  horizontal; blocos `<pre>` usam `white-space: pre-wrap` para também quebrar
  linha
- Usuário pode fechar e voltar ao preview

---

## 5. Components and Files

### Componentes Principais

#### `EmailLayoutContainer`

**Arquivo**:
`packages/frontend/src/pages/email-admin/ui/email-layout-container.web.tsx`

**Responsabilidades**:

- Gerenciar layout unificado com `ResizablePanelGroup`
- Controlar visibilidade do Preview Pane
- Persistir preferências de largura (localStorage)
- Adaptar layout para mobile/tablet (Sheet para preview)

**Props**:

```typescript
interface EmailLayoutContainerProps {
  folders: EmailFolder[]
  selectedFolderId: string | null
  onSelectFolder: (folderId: string) => void
  foldersLoading: boolean
  messages: EmailMessage[]
  selectedMessageId: string | null
  onSelectMessage: (messageId: string) => void
  messagesLoading: boolean
  currentMessage: EmailViewerMessage | null
  messageLoading: boolean
  onReply?: () => void
  onForward?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onExpand?: (message: EmailViewerMessage) => void
  onDisconnect?: () => void
  isMobile?: boolean
}
```

**Estrutura de Layout (Desktop)**:

```
┌─────────────────────────────────────────────────────────────┐
│  Pastas (fixo) │  Lista (resizable) │ Preview (resizable)   │
│   [ícone]      |    [Atualizar]     │                       │
│    Pastas      │     [Handle]       │                       │
└─────────────────────────────────────────────────────────────┘
```

- Cabeçalho "Pastas": ícone à esquerda, texto "Pastas", botão "Atualizar
  mensagens" à direita (h-7, text-xs, mesmo padrão do botão "Selecionar"). Prop
  `onRefresh` em `EmailLayoutContainer`; `EmailFolderList` recebe `onRefresh` e
  `refreshLoading`.

**Estrutura de Layout (Mobile)**:

```
┌─────────────────────┐
│  Pastas             │
│  [Desconectar]      │
├─────────────────────┤
│  Lista de Mensagens │
│                     │
│  [Sheet lateral]    │ ← Abre quando mensagem é selecionada
└─────────────────────┘
```

#### `EmailViewer` (Modificado)

**Arquivo**: `packages/frontend/src/pages/email-admin/ui/email-viewer.web.tsx`

**Mudanças**:

- Adicionada prop `onExpand` para abrir dialog
- Botão "Expandir" no header
- Scroll interno melhorado com `ScrollArea`
- Corpo da mensagem: viewport do preview com `overflow-x-auto` para permitir
  scroll horizontal quando o conteúdo (assinaturas, tabelas, imagens)
  ultrapassar a largura do painel; bloco prose com `break-words` e
  `[&_pre]:whitespace-pre-wrap`; no dialog de expansão mantém leitura linear sem
  scroll horizontal
- Indicador visual de ajuste
- Header reorganizado com duas linhas de ações e empilhamento responsivo para
  evitar sobreposição com os metadados da mensagem

**Nova Prop**:

```typescript
onExpand?: (message: EmailViewerMessage) => void
```

**Botões adaptativos no Preview (estilo Outlook) – NÃO REMOVER**

Quando o usuário reduz a largura do painel de preview (arrastando o separador
entre lista e preview), os botões **Responder**, **Encaminhar** e **Expandir**
devem passar a exibir **apenas o ícone**, com **tooltip** ao passar o mouse
mostrando o texto (Responder, Encaminhar, Expandir). Isso evita que os botões
fiquem ocultos ou quebrados em monitores menores ou quando o preview está
estreito.

- **Arquivo**: `packages/frontend/src/pages/email-admin/ui/email-viewer.web.tsx`
- **Implementação**:
  - Componente interno `ActionButton` com prop `compact`: quando `compact=true`,
    mostra só ícone e envolve o botão em `Tooltip` com a label.
  - Estado `isCompact` derivado da largura do container via `ResizeObserver`
    (threshold 500px: largura < 500px → modo compacto).
  - O div que recebe `ref={containerRef}` (observado pelo ResizeObserver)
    **deve** ter `min-w-0` na `className` para que o container encolha
    corretamente dentro do layout flex do `ResizablePanel`; sem `min-w-0` o
    recurso não funciona.
- **Regras para IAs / Code Review**: não remover o `ActionButton`, o
  `ResizeObserver`, a prop `compact={isCompact}` nos botões
  Responder/Encaminhar/Expandir, nem a classe `min-w-0` do container. Não
  substituir por breakpoints de tela (ex.: `sm:inline`); o comportamento é
  baseado na **largura do container**, não no viewport.

#### `EmailFullViewDialog`

**Arquivo**:
`packages/frontend/src/pages/email-admin/ui/email-full-view-dialog.web.tsx`

**Características**:

- Dialog fullscreen ou modal grande (85vh, max-w-4xl)
- Estrutura conforme skill `dialogs-implementation`: Header com gradiente, Body
  com `scrollbarGutter: "stable"`, Footer obrigatório
- Footer com botões Fechar, Responder e Encaminhar
- Reutiliza `EmailViewer` em modo `embedMode` (omite ações no corpo)
- **Header da mensagem no dialog**: no bloco de metadados (data, De, Para), no
  canto superior direito, botão "Mais opções" com dropdown: Marcar como lido/não
  lido, Destacar/Remover destaque, Arquivar, separador, Denunciar spam e Excluir
  (ações destrutivas em vermelho). Handlers passados pela page (`onMarkRead`,
  `onMarkUnread`, `onStar`, `onUnstar`, `onArchive`, `onDelete`, `onMarkSpam`,
  `onMarkNotSpam`); opção Arquivar oculta quando `isArchiveFolder`.
- **Nested dialogs**: quando Responder ou Encaminhar abre a
  `EmailComposerDialog`, a dialog pai aplica `data-nested-parent` e overlay
  escuro (bg-black/45), conforme mecanismo de nested dialogs da skill
- Scroll independente do conteúdo

---

## 6. Data and State

### Estado na Página Principal

```typescript
// Estados de conexão
const [connected, setConnected] = useState(false)
const [accounts, setAccounts] = useState<Account[]>([])

// Estados de pastas e mensagens
const [folders, setFolders] = useState<EmailFolder[]>([])
const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
const [messages, setMessages] = useState<EmailMessage[]>([])
const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
const [currentMessage, setCurrentMessage] = useState<EmailViewerMessage | null>(
  null
)

// Estado de dialog de expansão
const [isFullViewOpen, setIsFullViewOpen] = useState(false)
const [fullViewMessage, setFullViewMessage] =
  useState<EmailViewerMessage | null>(null)
```

### Persistência de Preferências

**LocalStorage Key**: `email-panel-sizes`

**Estrutura**:

```json
{
  "folders": 20,
  "messages": 44,
  "preview": 56
}
```

**Valores Padrão**:

- Pastas: 20% (fixo, não redimensionável)
- Lista: 44%
- Preview: 56%

### Estrela = remetente importante (não por mensagem)

**Projeto**: A estrela na lista de mensagens representa **importância do
remetente**, não da mensagem individual. Ao clicar na estrela de uma mensagem, o
**remetente** passa a ser marcado como importante (ou deixa de ser); **todas**
as mensagens desse remetente passam a mostrar estrela na lista, no preview e no
dialog; ao desmarcar, o remetente deixa de ser importante e **todas** as
mensagens dele perdem a estrela.

**Estado**:

- `highlightedSenderKeys` (Set de chaves de remetente) em
  `packages/frontend/src/pages/email-admin/model/carga.ts`, consumido por
  `ui/EmailAdminPage.web.tsx`
- Persistido em localStorage: `admin-email-highlighted-senders`
- `handleToggleStar` atualiza `highlightedSenderKeys` (add/remove remetente) e
  também o `isStarred` da mensagem clicada + chamada à API Zoho (star/unstar)

**Onde está**:

- Lista: `packages/frontend/src/pages/email-admin/ui/email-message-list.web.tsx`
  — botão estrela usa
  `currentlyStarred = msg.isStarred || highlightedSenderKeys?.has(getSenderKey(msg))`
  e chama `onToggleStar(msg.messageId, !currentlyStarred)`; o toggle afeta o
  remetente inteiro
- Filtro "Starred": mensagens que têm `m.isStarred` **ou** remetente em
  `highlightedSenderKeys` aparecem no filtro (useMemo em `model/carga.ts`)

**Regra para IAs / Code Review**: Não desacoplar o toggle da estrela do
`highlightedSenderKeys`. O comportamento intencional é "estrela = remetente
importante"; alterar para "estrela = apenas esta mensagem" seria mudança de
escopo. Ver comentários em `handleToggleStar` e nas props de `EmailMessageList`.

---

## 7. Constraints and Edge Cases

### Responsividade

- **Mobile (< 768px)**: Layout em coluna única, Sheet lateral para preview
- **Tablet (768px - 1024px)**: Layout adaptado, preview pode ser oculto
- **Desktop (1024px+)**: Layout completo com 3 colunas; resizable apenas entre
  lista e preview
- **XL (1280px+)**: Layout completo com preview sempre visível

### Limites de Redimensionamento

- **Painel de Pastas**: largura fixa (não redimensionável)
- **Painel de Mensagens**: minSize="30%" e maxSize="(100 - previewMin)%"
  (percentuais devem ser string com `%`)
- **Painel de Preview**: limites baseados em 500px (min) e 800px (max),
  convertidos para percentual do container do `ResizablePanelGroup` e enviados
  como string com `%`
- **Sincronização de bounds**: ajustes do preview respeitam o minSize de 30% do
  painel de mensagens para evitar salvar tamanhos inválidos
- Preferências de largura são normalizadas e ajustadas aos limites calculados
  para evitar painel travado por valores fora do intervalo

### Edge Cases

1. **Mensagem sem conteúdo**: Exibe placeholder "Sem conteúdo"
2. **Mensagem sem assunto**: Exibe "(Sem assunto)"
3. **Erro ao carregar mensagem**: Toast de erro, mantém estado anterior
4. **LocalStorage indisponível**: Usa valores padrão, não quebra
5. **Fechar Sheet em mobile**: Limpa seleção de mensagem

---

## 8. Error Handling

### Erros de Conexão

- **401 Unauthorized**: Desconecta automaticamente, exibe card de conexão
- **Erro ao carregar pastas**: Toast de erro, mantém estado anterior
- **Erro ao carregar mensagens**: Toast de erro, lista vazia
- **Erro ao carregar mensagem**: Toast de erro, mantém preview anterior

### Erros de Ações

- **Arquivar/Excluir falha**: Toast de erro com mensagem específica
- **Erro de rede**: Toast genérico com instruções

---

## 9. Performance and Accessibility

### Performance

- **Lazy loading**: Preview carregado apenas quando necessário
- **Memoização**: `useCallback` para handlers de resize
- **Virtual scrolling**: Considerado para listas grandes (Fase 2)
- **Debounce**: Não necessário (resize é nativo do react-resizable-panels)

### Acessibilidade

- **ARIA Labels**: Todos os handles têm `aria-label` descritivo
- **Keyboard Navigation**: Handles são focáveis com `tabIndex={0}`
- **Focus States**: `focus-visible:ring-2` nos handles
- **Screen Readers**: Títulos e descrições adequados
- **Contraste**: Cores seguem WCAG 2.1 AA

### Feedback Visual

- **Cursor resize**: `cursor-col-resize` nos handles
- **Hover states**: `hover:bg-orange-100` nos handles
- **Transições**: `transition-colors` para mudanças suaves
- **Indicadores**: Handles com ícone `GripVertical`
- **Scrollbar Pastas**: aparece apenas no hover e usa thumb/setas laranja

---

## 10. Tests and Validation

### Testes Manuais

#### Desktop

1. **Ajuste de Painéis**:

- [ ] Arrastar handle entre pastas e mensagens ajusta largura [ ] Arrastar
      handle entre mensagens e preview ajusta largura [ ] Larguras são salvas e
      restauradas na próxima visita [ ] Limites min/max são respeitados

2. **Seleção de Mensagem**:

- [ ] Clicar em mensagem exibe preview [ ] Preview mostra conteúdo completo [ ]
      Botões de ação funcionam (Responder, Encaminhar, Arquivar, Excluir)

3. **Expansão de Mensagem**:

- [ ] Botão "Expandir" abre dialog [ ] Dialog mostra mensagem completa [ ]
      Fechar dialog volta ao preview

#### Tablet

1. **Layout Adaptado**:

- [ ] Layout se adapta corretamente [ ] Preview pode ser aberto em dialog se
      necessário

#### Mobile

1. **Navegação Sequencial**:

- [ ] Pastas aparecem no topo [ ] Lista de mensagens abaixo [ ] Clicar em
      mensagem abre Sheet lateral [ ] Fechar Sheet limpa seleção

### Testes de Acessibilidade

- [ ] Navegação por teclado funcional (Tab, Enter, Escape)
- [ ] Screen reader anuncia mudanças de layout
- [ ] Contraste adequado em todos os elementos
- [ ] Foco visível em todos os elementos interativos

---

## 11. Related Docs

- `docs/features/admin-zoho-mail-integration.md` - Integração Zoho Mail
- `docs/features/admin-system.md` - Sistema administrativo
- `docs/features/design-system.md` - Design system
- `docs/features/dialog-lab.md` - Padrões de dialog

---

## 12. Change Log

- **2026-02-02**: Dropdown "Mais opções" na dialog de visualização completa
  - No bloco de metadados (data, De, Para) da dialog expandida, botão "Mais
    opções" no canto superior direito com menu completo (marcar lido/não lido,
    destacar, arquivar, denunciar spam, excluir). Ações destrutivas em vermelho;
    ícones e separador refinados.
- **2026-02-02**: Scroll horizontal no preview restaurado
  - Viewport do preview com `overflow-x-auto` (antes `overflow-x-hidden`) para
    que mensagens com conteúdo largo (assinaturas, tabelas) exibam barra de
    rolagem horizontal e o administrador possa ler a mensagem completa.
  - Wrapper do corpo com `min-w-fit` para o conteúdo poder acionar o scroll
    quando for mais largo que o painel.
- **2026-02-01**: Scrollbar do preview com espessura consistente
  - Thumb do `ScrollArea` passou a ter espessura fixa por orientação (8px),
    evitando discrepância visual entre vertical e horizontal.
- **2026-01-26**: Implementação completa da UI/UX estilo Outlook
  - Criado `EmailLayoutContainer` com layout unificado e resizable
  - Modificado `EmailViewer` com botão Expandir
  - Criado `EmailFullViewDialog` para visualização completa
  - Refatorado `app/admin/email/page.tsx` para usar novo layout
  - Implementada persistência de preferências (localStorage)
  - Adicionada responsividade mobile/tablet com Sheet
  - Melhorias de acessibilidade (ARIA labels, keyboard nav, focus states)
  - Ajuste visual para bloco único (remoção de cards internos e separadores por
    painel)
  - Painel de Pastas fixo; redimensionamento apenas entre Mensagens e Preview
  - Scrollbar do painel de Pastas com thumb e setas laranja, visível apenas no
    hover
- **2026-01-30**: Iteração enterprise
  - Filtro por período integrado ao painel
  - Ações rápidas na lista (marcar lido, arquivar, excluir)
  - Atalhos de teclado com dialog de referência
  - Mover para pasta disponível no preview e em ações em massa
- **2026-01-31**: Organização do preview da mensagem
  - Header do `EmailViewer` reestruturado em duas linhas de ações
  - Ações agrupadas e empilhamento responsivo para evitar sobreposição
  - Largura do seletor "Mover para" ajustada com min/max para se adaptar ao
    conteúdo
  - Estilo e altura dos seletores alinhados aos botões outline
  - Hover/shadow dos seletores iguais aos botões irmãos
- **2026-01-31**: Limites do preview baseados em pixels
  - Min/max de 500px/800px convertidos para percentual do container do
    `ResizablePanelGroup`, mantendo resize funcional
- **2026-01-31**: Sincronização de bounds respeita o minSize de mensagens
  - Ajuste do preview evita forçar lista abaixo de 30% e não salva valores
    inválidos

---

## 13. Referências Técnicas

### Bibliotecas Utilizadas

- **react-resizable-panels** (v4.4.1) - Painéis ajustáveis
- **@base-ui/react/dialog** - Dialog de visualização completa (via
  `packages/ui/src/web/Dialog.web.tsx`)
- **@radix-ui/react-scroll-area** - Scroll interno
- **framer-motion** - Animações

### Breakpoints

- **Mobile**: < 768px (usando `useIsMobile` hook)
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+
- **XL**: 1280px+

### Estrutura de Arquivos

```
packages/frontend/src/pages/email-admin/ui/
├── email-layout-container.web.tsx    # Container principal unificado
├── email-viewer.web.tsx               # Visualizador (modificado)
├── email-full-view-dialog.web.tsx    # Dialog de visualização completa
├── email-folder-list.web.tsx          # Lista de pastas
└── email-message-list.web.tsx         # Lista de mensagens
```

---

_Última atualização: 2026-02-01_

## Consumidor Expo — onda 84 (2026-10-03, sem commit)

Conta/pastas/lista/filtros/preview/ações/compositor usam carga e compositor
comuns. Native adapta datas AAAA-MM-DD e diálogos; o host fornece HTML isolado,
seleção/compartilhamento de arquivos, UUID e armazenamento por usuário/locadora.
Web mantém JSX, estilos, atalhos e resize. Zoho conecta pelo painel web
autenticado, configurado no Expo; o retorno apenas recarrega a conta. Sem tokens
em URL ou OAuth novo. Provas locais e limites em [onda 84](shared-api-host.md).
HTML, layout, anexos, teclado, gestos, aparelho e provedor não certificados.
