# 🧪 Dialog Lab (Base UI)

> **Caminhos atuais (conferidos em 2026-09-30)**: o `Dialog` do design system
> está em `packages/ui/src/web/Dialog.web.tsx` (`@gb-locacoes/ui`);
> `components/ui/dialog.tsx` é o caminho antigo.

## 📋 Visão Geral

- Implementamos um laboratório dedicado para o novo componente de dialog baseado
  em [Base UI](https://base-ui.com/react/components/dialog#open-from-a-menu).
- O playground em `app/playground/page.tsx` concentra todas as experimentações
  atuais, permitindo validar animações, layout, acessibilidade e interações
  antes de reintegrar os fluxos administrativos.
- Removemos os modais legados do projeto (wrappers Radix customizados, modais de
  categorias e preview de equipamentos) para garantir que a migração aconteça
  sobre uma única base.
- A página `app/admin/categorias/page.tsx` está temporariamente em modo
  manutenção e `app/admin/equipamentos/page.tsx` opera com um overlay simples
  até que o novo dialog seja promovido para produção.

## 🎯 Objetivos

1. **Unificação** – substituir todos os modais antigos por uma única
   implementação composta (`Dialog.Root`, `Dialog.Backdrop`, `Dialog.Popup`,
   etc.).
2. **Consistência visual** – adotar tokens de espaço, tipografia e cores
   definidos em `docs/features/design-system.md`.
3. **Acessibilidade** – aproveitar o foco travado e os atributos ARIA
   automáticos do Base UI, incluindo suporte a dialogs aninhados.
4. **Reutilização** – estruturar header, área scrollável e footer como blocos
   independentes que podem ser compostos conforme o fluxo (preview, formulário,
   confirmação).

## 🏗️ Arquitetura do Playground

| Seção                                | Descrição                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `EquipmentDialogDemo`                | Demonstração principal com conteúdo rico: badges, resumo de locação, formulário rápido e CTA.                                   |
| `ScrollContent`                      | Conteúdo interno envolto por `ScrollArea`, respeitando `max-h-[60vh]` e mantendo o ritmo vertical padrão (`px-6/py-6 sm:px-8`). |
| `NestedDialogDemo`                   | Fluxo com dialogs aninhadas demonstrando `data-[nested-dialog-open]` e transições independentes.                                |
| `packages/ui/src/web/Dialog.web.tsx` | Wrapper universal para o Dialog do Base UI, com backdrop/popup padronizados e subcomponentes de layout.                         |

## 🧱 Componente Universal `Dialog`

- **Localização:** `packages/ui/src/web/Dialog.web.tsx`
- **Propósito:** centralizar as classes e animações oficiais, evitando
  duplicação de constantes (`BACKDROP_CLASSES`, `POPUP_CLASSES`, etc.).
- **Subcomponentes incluídos:** `Root`, `Trigger`, `Portal`, `Backdrop`,
  `Popup`, `Content`, `Header`, `HeaderIcon`, `CloseButton`, `Body`,
  `BodyViewport`, `BodyContent`, `Footer`, `Title`, `Description` e `Close`.
- **Variantes do popup:**
  - `default` – altura controlada (`80vh`), usada em fluxos administrativos
    completos.
  - `compact` – `w-96` com padding interno, ideal para dialogs aninhadas ou
    confirmações.
  - `unstyled` – não aplica estilos, permitindo layout totalmente customizado.
- **Estilos exportados:** `dialogStyles` expõe as classes base para ajustes
  avançados sem duplicar strings.

### Exemplo mínimo

```tsx
import { Dialog } from "@/components/ui/dialog"
;<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild>…</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.HeaderIcon>…</Dialog.HeaderIcon>
          <Dialog.Title>Título</Dialog.Title>
          <Dialog.CloseButton aria-label="Fechar" />
        </Dialog.Header>
        <Dialog.Body>
          <Dialog.BodyViewport>
            <Dialog.BodyContent>{/* Conteúdo scrollável */}</Dialog.BodyContent>
          </Dialog.BodyViewport>
        </Dialog.Body>
        <Dialog.Footer>{/* Ações */}</Dialog.Footer>
      </Dialog.Content>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

### Fluxo de Estados

```tsx
const [open, setOpen] = useState(false)

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild>…</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Content>
        {/* Header, conteúdo e footer modulares */}
      </Dialog.Content>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

- `dismissible` e `modal` ficam ativos por padrão para preservar foco, scroll
  lock e click outside controlado.
- `Dialog.Close` é sempre renderizado como `Button` para manter rastreamento e
  estados visuais documentados no design system.
- Conteúdos longos utilizam `ScrollArea` com `maxHeight` calculado para
  preservar espaço para header/footer.

## 🎨 Estilos Principais

- **Camadas**: `z-[var(--layer-dialog-backdrop)]` para o backdrop e
  `z-[var(--layer-dialog)]` para o popup; não use números mágicos.
- **Backdrop**: `bg-slate-950/60 + backdrop-blur-sm` com animações
  `data-[starting-style]`/`data-[ending-style]` e `position: fixed` em todos os
  navegadores (incluindo iOS). Não aplique condicionais que troquem `fixed` por
  `absolute`, pois isso permite que o fundo seja exibido ao rolar a página.
- **Popup**: `rounded-2xl`, sombra elevada
  (`shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)]`) e `ring-1` para reforçar
  legibilidade em temas claros.
- **Header**: `px-6 py-5 sm:px-8`, título `text-2xl` (ou `text-xl` em variantes
  menores) e badge primária.
- **Footer**: grade flexível (`flex flex-col gap-3 sm:flex-row`) garantindo que
  CTAs fiquem lado a lado em desktop e empilhados em mobile.
- **Conteúdo**: cartões internos com `border border-slate-200`, superfícies
  secundárias em `bg-slate-50/60` e destaque laranja para instruções
  (`bg-orange-50/80`).

## ♿ Acessibilidade

- Base UI gerencia `aria-hidden`, `aria-modal`, focus trap e stacking context
  automaticamente.
- Botões fecham dialog via `Dialog.Close asChild`, preservando rótulos
  (`aria-label`) e mantendo clique keyboard-friendly.
- Dialogs aninhadas utilizam `data-[nested-dialog-open]` para informar estados
  ao dialog pai, permitindo estilização condicional no futuro.
- O overlay manual implementado em `app/admin/equipamentos/page.tsx` permanecerá
  apenas até a migração para o componente Base UI (garantindo compatibilidade
  temporária).

## ?? Responsividade dos fluxos nested

### Fallback do IconCustomizationBlock no mobile

- O seletor de ícones (`IconCustomizationBlock`) passou a operar em modo
  híbrido: em desktops ele continua dentro do `Popover` do preview da categoria,
  mas em telas detectadas por `useIsMobile` (até 768px) ele abre um `Dialog`
  aninhado dedicado.
- `CategoryShowcase` expõe a prop `onIconBoxRequest`. Quando o usuário toca no
  ícone dentro do preview e estamos no mobile, esse callback dispara
  `setIconDialogOpen(true)` no `CategoryDialogModal`.
- O dialog secundário reutiliza `Dialog.Root`, `Dialog.Backdrop` e
  `Dialog.Popup` (variante `default`) para garantir o mesmo conjunto de tokens
  (`--layer-dialog`, `--layer-dialog-backdrop`) e animações
  (`scale-[calc(1-0.1*var(--nested-dialogs))]`) documentadas neste laboratório,
  mas sobrescreve as utilitárias para deixá-lo `bg-transparent`, `shadow-none`,
  `ring-0` e limitado a
  `max-w-[min(470px,_calc(100vw-0.5rem))]/max-h-[calc(100vh-0.75rem)]`, evitando
  uma “caixa dentro da caixa” quando abrimos o seletor em telas pequenas.
- O `IconCustomizationBlock` concentra o guideline de largura
  (`w-[min(440px,_calc(100vw-0.75rem))] sm:w-[460px]`); o dialog pai não injeta
  mais `w-full`/`max-w-*`, evitando que os utilitários sejam sobrescritos. Para
  o popover desktop, passamos `w-[404px]` / `max-w-[404px]` na prop `className`,
  preservando o layout original enquanto o fallback mobile continua ocupando a
  largura expandida.
- Pontos de integração:
  - `packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx`:
    controla `iconDialogOpen`, sincroniza `data-nested-parent` no popup pai e
    renderiza o `IconCustomizationBlock` dentro do dialog mobile.
  - `packages/frontend/src/features/abas-categoria/ui/Abas.web.tsx`: decide
    dinamicamente entre montar o `Popover` (desktop) ou delegar ao callback
    (mobile), mantendo a experiência de hover/press.
- Benefício: o seletor respeita as safe areas do Safari móvel, evitando overflow
  sobre toolbars nativos sem sacrificar o popover rico em telas maiores.

## 🔬 Casos Cobertos

- **Preview rico**: substituição planejada para previews de equipamentos,
  categorias e orçamentos.
- **Fluxo aninhado**: confirmações e passos subsequentes (ex.: agendar retorno
  dentro de um fluxo de contato).
- **Formulários rápidos**: campo de nome, e-mail, telefone e textarea já
  testados com `Input` e `Textarea` do design system.
- **Dialogs encadeadas (Customize/Edit)**: padrão oficial para abrir uma segunda
  dialog a partir de ações como “Editar”, “Customizar” ou “Configurar”.

## 🧩 Configurador de Categoria (Playground Atualizado)

- **Localização principal**:
  `packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx` expõe o
  `CategoryDialogModal`, o `CategoryDialog` de demonstração e os helpers
  utilizados nas dialogs aninhadas.
- **Consumo no playground**: `app/playground/page.tsx` importa diretamente o
  `CategoryDialog`, garantindo que o playground e os fluxos produtivos usem o
  mesmo componente compartilhado (sem wrappers adicionais).
- **Nested dialog**: o botão “Editar” dentro do preview da categoria abre uma
  segunda dialog reaproveitando `Dialog.Backdrop` e
  `Dialog.Popup variant="compact"` para manter as animações e escalas oficiais
  de dialogs encadeadas.
- **Campos disponíveis**:
  - Cores do badge (fundo, texto, ícone) iguais ao design system legado.
  - Seletor de cores com amostras reduzidas (~44px) e espaçamentos compactos,
    preservando a área de toque acessível alinhada ao layout legado.
  - Grade completa de ícones (`ALL_AVAILABLE_ICONS` – Lucide + custom) com busca
    normalizada, mantendo fallback automático para `Tag`. Os grupos
    pré-definidos de “Construção & Ferramentas”, “Transporte & Logística”,
    “Pessoas & Status”, “Comunicação & Mídia”, “Indicadores & Métricas” e “Clima
    & Ambiente” exibem coleções temáticas reais (ex.: `Hammer`, `Truck`,
    `Users`, `PhoneCall`, `TrendingUp`, `Sunrise`) para acelerar a seleção sem
    repetições artificiais.
  - Configuração do ícone do cartão principal via:
    - Upload de SVG (até 64kb) com sanitização automática;
    - URL externa `https://… .svg` validada antes de aplicar.
    - Campo “Nome do ícone” com contador (máx. 50 caracteres) e validação
      inline, exibindo erro quando o limite é ultrapassado e surgindo apenas
      quando há pré-visualização válida (upload ou URL).
    - Botões "Cancelar" e "Salvar" no rodapé do painel personalizado, com o
      salvamento desabilitado até definir um nome válido e um ícone carregado,
      além de toasts de feedback para sucesso ou falha.
- Tooltip contextual ao lado de “Ícone” exibe mensagem única prefixada com emoji
  💡, explicando o fallback padrão e respeitando o token `--layer-tooltip`.
- Dentro do card, a seleção do ícone Lucide aparece antes da seção de cores, e o
  seletor de origem (Padrão / Upload / URL externa) foi deslocado para logo após
  o bloco de cores, mantendo o fluxo de personalização mais intuitivo.
- **Seletor de cor ampliado**: as amostras agora têm aproximadamente 44px
  (`h-11 w-11`) com `shadow-inner`, mantendo acessibilidade em telas touch e
  alinhamento com o padrão de espaçamento adotado no restante do playground.
- **Preview imediato**: o cartão grande e a badge são renderizados com o mesmo
  helper (`renderCategoryIcon`), garantindo que uploads/URLs apareçam no preview
  e nos cards simulados.
- **Playground isolado**: a rota `/playground/icon-customization` exibe apenas o
  bloco `IconCustomizationBlock` com largura fixa de 404px (altura automática),
  reproduzindo o layout do print de referência sem headers adicionais.
- **Popover estável no seletor**: o botão do ícone passou a ser envolvido por um
  wrapper fixo (`h-14 w-14`) que não sofre `transform` em hover, mantendo o
  anchor usado pelo Radix Popover estável e evitando o “tremor” observado quando
  o mouse saía do cartão para o painel de personalização.
  - Ajuste aplicado em
    `packages/frontend/src/features/abas-categoria/ui/Abas.web.tsx` (cards do
    playground).
  - Ajuste aplicado em
    `packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx` (preview
    interno da dialog).
- Com o anchor estabilizado, removemos o seletor `[&_*]:!transform-none` que
  estava aplicado ao portal do popover, permitindo que efeitos legítimos de
  `transform` (como o sublinhado animado das tabs) funcionem normalmente.
- **Fundo neutro**: o bloco “Preview do destaque” utiliza o mesmo gradiente
  suave (`bg-gradient-to-br from-slate-50 to-slate-100`) adotado no preview
  principal, com tipografia em tons `slate`, destacando o cartão escuro sem
  introduzir contrastes desnecessários. Em mobile, o cabeçalho centraliza,
  aumenta o espaçamento entre linhas e quebra “Aba atual” em duas linhas,
  enquanto em desktop mantém o alinhamento horizontal.
- **Card único de personalização**: preview, biblioteca de ícones e ajustes de
  cores coexistem dentro da mesma moldura arredondada. Divisores internos
  (`border-t`, `pt-6`) separam visualmente cada etapa sem quebrar o card,
  reduzindo ruído visual e mantendo o foco no conteúdo principal.
- **Componente extraído**: o bloco de personalização (abas, buscas, filtros e
  upload) agora vive em
  `packages/frontend/src/widgets/personalizar-icone/ui/Bloco.web.tsx`,
  permitindo evolução isolada e reuse em outros fluxos administrativos. Os
  controles de cor permanecem em seção dedicada logo abaixo do preview para
  reforçar a hierarquia visual antes da seleção de ícones.
- **Folha de rascunho dedicada**: `app/playground/icon-customization/page.tsx`
  carrega o componente em modo independente, com estado próprio e preview
  simplificado para testar rapidamente variantes de ícones/cores sem abrir a
  dialog principal.
- **Seletor estilo Notion**: o cabeçalho exibe abas `Ícones`, `Emoji`,
  `Fazer Upload` e a ação `Remover`, reproduzindo a UX das capturas enviadas
  pelo usuário. O estado ativo é persistido ao reabrir a dialog.
- **Biblioteca de emojis**: grade agrupada (Recentes, Pessoas, Natureza,
  Objetos, Símbolos, Bandeiras) com busca dedicada, botões de navegação rápida e
  CTA "Ir para Personalizado" no rodapé; a seção Recentes agora reflete o
  histórico real do usuário (persistido em `localStorage`) e surge apenas após a
  primeira seleção.
- **Fallback de bandeiras**: a classe `.emoji-font` usa a fonte
  `Twemoji Country Flags` (`public/fonts/twemoji-country-flags.woff2`)
  registrada em `app/globals.css` para garantir que os emojis de países apareçam
  corretamente no Windows (onde o sistema converte `🇧🇷` em "BR"). Qualquer
  grid/preview de emojis deve aplicar essa classe para manter consistência com o
  playground.
- **Biblioteca de ícones**: busca unificada com seletor lateral (Lucide x
  Personalizados) e grupos com atalhos no rodapé, permitindo saltar entre
  sessões longas sem perder o contexto.
- **Painel Personalizado**: mantém os botões "Padrão", "Upload" e "URL externa"
  na aba `Personalizado`, com feedback de upload, preview do SVG/URL e botão de
  remoção alinhado ao padrão Notion. O campo "Nome do ícone" fica sempre visível
  ao selecionar Upload/URL, permitindo salvar somente quando o nome for
  preenchido (≤ 50 caracteres), com botões dedicados de cancelar e salvar.
- **Ordem dos controles**: após o preview, o primeiro bloco apresenta a busca na
  biblioteca de ícones Lucide/custom; em seguida, o seletor de origem
  (Padrão/Upload/URL) para o ícone principal e, por fim, o bloco de cores do
  badge. O fluxo top-down mantém o layout compacto e evita cartões aninhados
  redundantes dentro da dialog.

## 🎨 Estilos Principais

- **Camadas**: `z-[var(--layer-dialog-backdrop)]` para o backdrop e
  `z-[var(--layer-dialog)]` para o popup; não use números mágicos.
- **Backdrop**: `bg-slate-950/60 + backdrop-blur-sm` com animações
  `data-[starting-style]`/`data-[ending-style]`.
- **Popup**: `rounded-2xl`, sombra elevada
  (`shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)]`) e `ring-1` para reforçar
  legibilidade em temas claros.
- **Header**: `px-6 py-5 sm:px-8`, título `text-2xl` (ou `text-xl` em variantes
  menores) e badge primária.
- **Footer**: grade flexível (`flex flex-col gap-3 sm:flex-row`) garantindo que
  CTAs fiquem lado a lado em desktop e empilhados em mobile.
- **Conteúdo**: cartões internos com `border border-slate-200`, superfícies
  secundárias em `bg-slate-50/60` e destaque laranja para instruções
  (`bg-orange-50/80`).

## ♿ Acessibilidade

- Base UI gerencia `aria-hidden`, `aria-modal`, focus trap e stacking context
  automaticamente.
- Botões fecham dialog via `Dialog.Close asChild`, preservando rótulos
  (`aria-label`) e mantendo clique keyboard-friendly.
- Dialogs aninhadas utilizam `data-[nested-dialog-open]` para informar estados
  ao dialog pai, permitindo estilização condicional no futuro.
- O overlay manual implementado em `app/admin/equipamentos/page.tsx` permanecerá
  apenas até a migração para o componente Base UI (garantindo compatibilidade
  temporária).

## 🔬 Casos Cobertos

- **Preview rico**: substituição planejada para previews de equipamentos,
  categorias e orçamentos.
- **Fluxo aninhado**: confirmações e passos subsequentes (ex.: agendar retorno
  dentro de um fluxo de contato).
- **Formulários rápidos**: campo de nome, e-mail, telefone e textarea já
  testados com `Input` e `Textarea` do design system.
- **Dialogs encadeadas (Customize/Edit)**: padrão oficial para abrir uma segunda
  dialog a partir de ações como “Editar”, “Customizar” ou “Configurar”.

## 🧩 Configurador de Categoria (Playground Atualizado)

- **Localização**:
  `packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx` concentra
  o `CategoryDialog` e o `DesignDialog`; `app/playground/page.tsx` consome o
  componente diretamente para demonstrar o fluxo completo.
- **Nested dialog**: o botão “Editar” dentro do preview da categoria abre uma
  segunda dialog reaproveitando `Dialog.Backdrop` e
  `Dialog.Popup variant="compact"` para manter as animações e escalas oficiais
  de dialogs encadeadas.
- **Campos disponíveis**:
  - Cores do badge (fundo, texto, ícone) iguais ao design system legado.
  - Seletor de cores com amostras reduzidas (36px) e espaçamentos compactos,
    preservando a área de toque acessível alinhada ao layout legado.
  - Grade completa de ícones (`ALL_AVAILABLE_ICONS` – Lucide + custom) com busca
    normalizada, mantendo fallback automático para `Tag`.
  - Configuração do ícone do cartão principal via:
    - Upload de SVG (até 64kb) com sanitização automática;
    - URL externa `https://… .svg` validada antes de aplicar.
- Tooltip contextual ao lado de “Ícone” exibe mensagem única prefixada com emoji
  💡, explicando o fallback padrão e respeitando o token `--layer-tooltip`.
- Dentro do card, a seleção do ícone Lucide aparece antes da seção de cores, e o
  seletor de origem (Padrão / Upload / URL externa) foi deslocado para logo após
  o bloco de cores, mantendo o fluxo de personalização mais intuitivo.
- **Seletor de cor ampliado**: as amostras agora têm 12x12px (`h-12 w-12`) com
  `shadow-inner`, mantendo acessibilidade em telas touch e alinhamento com o
  padrão de espaçamento adotado no restante do playground.
- **Preview imediato**: o cartão grande e a badge são renderizados com o mesmo
  helper (`renderCategoryIcon`), garantindo que uploads/URLs apareçam no preview
  e nos cards simulados.
- **Fundo neutro**: o bloco “Preview do destaque” utiliza o mesmo gradiente
  suave (`bg-gradient-to-br from-slate-50 to-slate-100`) adotado no preview
  principal, com tipografia em tons `slate`, destacando o cartão escuro sem
  introduzir contrastes desnecessários. Em mobile, o cabeçalho centraliza,
  aumenta o espaçamento entre linhas e quebra “Aba atual” em duas linhas,
  enquanto em desktop mantém o alinhamento horizontal.
- **Card único de personalização**: preview, biblioteca de ícones e ajustes de
  cores coexistem dentro da mesma moldura arredondada. Divisores internos
  (`border-t`, `pt-6`) separam visualmente cada etapa sem quebrar o card,
  reduzindo ruído visual e mantendo o foco no conteúdo principal.
- **Componente extraído**: o bloco de personalização (abas, buscas, filtros e
  upload) agora vive em
  `packages/frontend/src/widgets/personalizar-icone/ui/Bloco.web.tsx`,
  permitindo evolução isolada e reuse em outros fluxos administrativos. Os
  controles de cor permanecem em seção dedicada logo abaixo do preview para
  reforçar a hierarquia visual antes da seleção de ícones.
- **Folha de rascunho dedicada**: `app/playground/icon-customization/page.tsx`
  carrega o componente em modo independente, com estado próprio e preview
  simplificado para testar rapidamente variantes de ícones/cores sem abrir a
  dialog principal.
- **Seletor estilo Notion**: o cabeçalho exibe abas `Emoji`, `Ícones`,
  `Personalizado` e a ação `Remover`, reproduzindo a UX das capturas enviadas
  pelo usuário. O estado ativo é persistido ao reabrir a dialog.
- **Biblioteca de emojis**: grade agrupada (Recentes, Pessoas, Natureza,
  Objetos, Símbolos, Bandeiras) com busca dedicada, botões de navegação rápida e
  CTA "Ir para Personalizado" no rodapé; a lista de Recentes reflete o histórico
  salvo do usuário e só aparece após a primeira seleção, evitando hidratação
  divergente.
- **Biblioteca de ícones**: busca unificada com seletor lateral (Lucide x
  Personalizados) e grupos com atalhos no rodapé, permitindo saltar entre
  sessões longas sem perder o contexto.
- **Painel Personalizado**: mantém os botões "Padrão", "Upload" e "URL externa"
  na aba `Personalizado`, com feedback de upload, preview do SVG/URL e botão de
  remoção alinhado ao padrão Notion.
- **Ordem dos controles**: após o preview, o primeiro bloco apresenta a busca na
  biblioteca de ícones Lucide/custom; em seguida, o seletor de origem
  (Padrão/Upload/URL) para o ícone principal e, por fim, o bloco de cores do
  badge. O fluxo top-down mantém o layout compacto e evita cartões aninhados
  redundantes dentro da dialog.

## ♻️ Impacto nas Páginas

- `app/admin/categorias/page.tsx` agora exibe mensagem de manutenção até que a
  nova dialog seja integrada.
- `app/admin/equipamentos/page.tsx` utiliza overlay custom (sem Base UI) como
  solução temporária. O próximo passo é substituir este overlay pelo componente
  `Dialog` do playground.
- Todos os wrappers anteriores (`components/ui/dialog.tsx`, `
