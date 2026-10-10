# 🧪 Dialog Lab (Base UI)

> **Caminhos atuais (conferidos no clone pós-F em 2026-10-09)**: o `Dialog` do
> design system está em `packages/ui/src/web/Dialog.web.tsx`
> (`@gb-locacoes/ui`); `components/ui/dialog.tsx` é o caminho antigo.

## 📋 Visão Geral

- Implementamos um laboratório dedicado para o novo componente de dialog baseado
  em [Base UI](https://base-ui.com/react/components/dialog#open-from-a-menu).
- O antigo laboratório em `app/playground/page.tsx` foi substituído pela rota
  fina `apps/clients/web/src/app/(labs)/playground/page.tsx`. Ela monta
  `PlaygroundPage` de `@gb-locacoes/frontend/pages/playground`; na fonte atual,
  essa página demonstra benefícios e ScrollStack, não os demos de Dialog
  descritos no registro anterior abaixo.
- O seletor de ícones independente está em
  `apps/clients/web/src/app/(labs)/playground/icon-customization/page.tsx`, que
  monta `IconCustomizationPage` da mesma entrada pública. Os labs dependem de
  `PLATFORM_LABS_ENABLED=true` e são recusados em produção.
- Removemos os modais legados do projeto (wrappers Radix customizados, modais de
  categorias e preview de equipamentos) para garantir que a migração aconteça
  sobre uma única base.
- A manutenção de `app/admin/categorias/page.tsx` e o overlay temporário de
  `app/admin/equipamentos/page.tsx` pertenciam ao laboratório antigo; esses
  wrappers saíram em F. Hoje `CategoriasPage.web.tsx` monta
  `CategoryDialogModal`/`ViewCategoryDialog`, e `Lista.web.tsx` de
  `pages/equipamentos-admin` monta `ViewEquipmentDialog` e a confirmação de
  exclusão, todos com `Dialog` de `@gb-locacoes/ui`.

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

A tabela registra a composição do laboratório anterior à extração FSD.
`EquipmentDialogDemo`, `ScrollContent` e `NestedDialogDemo` não são exports da
`PlaygroundPage.web.tsx` atual; não procurá-los no host fino nem recriá-los como
uma segunda tela. O wrapper web do design system permanece o owner do Dialog
usado nos fluxos produtivos.

| Seção                                | Descrição                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `EquipmentDialogDemo`                | Demonstração principal com conteúdo rico: badges, resumo de locação, formulário rápido e CTA.                                   |
| `ScrollContent`                      | Conteúdo interno envolto por `ScrollArea`, respeitando `max-h-[60vh]` e mantendo o ritmo vertical padrão (`px-6/py-6 sm:px-8`). |
| `NestedDialogDemo`                   | Fluxo com dialogs aninhadas demonstrando `data-[nested-dialog-open]` e transições independentes.                                |
| `packages/ui/src/web/Dialog.web.tsx` | Wrapper web para o Dialog do Base UI, com backdrop/popup padronizados e subcomponentes de layout.                               |

## 🧱 Componente web `Dialog`

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
import { Dialog } from "@gb-locacoes/ui"
;<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger>Abrir</Dialog.Trigger>
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
  <Dialog.Trigger>Abrir</Dialog.Trigger>
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

- `Root`, `Trigger` e `Close` delegam ao Base UI; o wrapper não acrescenta uma
  prop `dismissible`. `modal` tem padrão `true`; `disablePointerDismissal` tem
  padrão `false`, no contrato instalado do primitive. Preserve foco, scroll lock
  e fechamento, sem reutilizar props de wrappers Radix antigos.
- `Dialog.CloseButton` fornece o X do cabeçalho. Para compor um botão de ação
  com `Dialog.Close`, use a API `render` do Base UI com `Button`; `asChild` não
  faz parte do wrapper atual.
- Conteúdos longos utilizam `ScrollArea` com `maxHeight` calculado para
  preservar espaço para header/footer.

## 🎨 Estilos Principais (registro do laboratório)

As classes descritas nesta unidade registram a composição anterior do
laboratório; não substituem as classes atuais de `Dialog.web.tsx`. O wrapper
atual conserva `fixed`, tokens `--layer-dialog*`, estados starting/ending e
nested; seu backdrop base é `bg-black/60` (dark `bg-black/70`) e suas variantes
são `default`, `compact` e `unstyled`. Ajustes de documentação não autorizam
alterar CSS, timing, cores ou variantes de UX no produto.

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
- Botões fecham via `Dialog.Close` (API `render` do Base UI quando composto com
  `Button`), preservando rótulos (`aria-label`) e acionamento por teclado.
- Dialogs aninhadas utilizam `data-[nested-dialog-open]` para informar estados
  ao dialog pai, permitindo estilização condicional no futuro.
- O overlay manual do antigo `app/admin/equipamentos/page.tsx` era uma
  compatibilidade temporária. Na fonte atual, o preview pertence a
  `packages/frontend/src/pages/equipamentos-admin/ui/VerEquipamento.web.tsx` e
  usa o Dialog do design system; o wrapper legado saiu em F.

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

## 🧩 Configurador de Categoria (registro do laboratório)

- **Localização principal**:
  `packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx` expõe o
  `CategoryDialogModal`, o `CategoryDialog` de demonstração e os helpers
  utilizados nas dialogs aninhadas.
- **Consumo produtivo atual**: `CategoriasPage.web.tsx` da mesma slice monta
  `CategoryDialogModal`. O consumo direto por `app/playground/page.tsx` era do
  playground antigo, removido; o host atual de labs monta `PlaygroundPage` pelo
  entrypoint do pacote e não importa o interno de categorias.
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
- **Folha de rascunho dedicada**:
  `apps/clients/web/src/app/(labs)/playground/icon-customization/page.tsx`
  delega a `IconCustomizationPage` do pacote frontend. O estado vem de
  `pages/playground/model/use-icon-customization.ts`, e o render web de
  `pages/playground/ui/IconCustomizationPage.web.tsx`, sem abrir o dialog pai.
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
  registrada em `packages/frontend/src/app/styles/base.web.css`, com a utility
  em `utilities.web.css`, para garantir que os emojis de países apareçam
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

## 🎨 Estilos Principais (registro do laboratório)

As classes descritas nesta unidade registram a composição anterior do
laboratório; não substituem as classes atuais de `Dialog.web.tsx`. O wrapper
atual conserva `fixed`, tokens `--layer-dialog*`, estados starting/ending e
nested; seu backdrop base é `bg-black/60` (dark `bg-black/70`) e suas variantes
são `default`, `compact` e `unstyled`. Ajustes de documentação não autorizam
alterar CSS, timing, cores ou variantes de UX no produto.

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
- Botões fecham via `Dialog.Close` (API `render` do Base UI quando composto com
  `Button`), preservando rótulos (`aria-label`) e acionamento por teclado.
- Dialogs aninhadas utilizam `data-[nested-dialog-open]` para informar estados
  ao dialog pai, permitindo estilização condicional no futuro.
- O overlay manual do antigo `app/admin/equipamentos/page.tsx` era uma
  compatibilidade temporária. Na fonte atual, o preview pertence a
  `packages/frontend/src/pages/equipamentos-admin/ui/VerEquipamento.web.tsx` e
  usa o Dialog do design system; o wrapper legado saiu em F.

## 🔬 Casos Cobertos

- **Preview rico**: substituição planejada para previews de equipamentos,
  categorias e orçamentos.
- **Fluxo aninhado**: confirmações e passos subsequentes (ex.: agendar retorno
  dentro de um fluxo de contato).
- **Formulários rápidos**: campo de nome, e-mail, telefone e textarea já
  testados com `Input` e `Textarea` do design system.
- **Dialogs encadeadas (Customize/Edit)**: padrão oficial para abrir uma segunda
  dialog a partir de ações como “Editar”, “Customizar” ou “Configurar”.

## 🧩 Configurador de Categoria (registro do laboratório)

- **Localização**:
  `packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx` concentra
  o `CategoryDialogModal` produtivo. O trecho anterior sobre consumo em
  `app/playground/page.tsx` e um `DesignDialog` separado é histórico: o antigo
  wrapper saiu, e `CategoriasPage.web.tsx` monta o dialog da mesma slice.
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
- **Folha de rascunho dedicada**:
  `apps/clients/web/src/app/(labs)/playground/icon-customization/page.tsx`
  delega a `IconCustomizationPage` do pacote frontend. O estado vem de
  `pages/playground/model/use-icon-customization.ts`, e o render web de
  `pages/playground/ui/IconCustomizationPage.web.tsx`, sem abrir o dialog pai.
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

- O antigo `app/admin/categorias/page.tsx` teve manutenção temporária e saiu em
  F. A rota atual `apps/clients/web/src/app/(admin)/admin/categorias/page.tsx`
  monta `CategoriasPage` pelo entrypoint; edição e preview são da slice.
- O antigo `app/admin/equipamentos/page.tsx` usou overlay provisório e saiu em
  F. A rota atual `apps/clients/web/src/app/(admin)/admin/equipamentos/page.tsx`
  monta a lista administrativa do pacote, cujo preview/confirmar já usam Dialog.
- `components/ui/dialog.tsx` é o wrapper antigo removido. O owner atual é
  `packages/ui/src/web/Dialog.web.tsx`, sem fachada de produto na raiz.

## Provas e limite da revisão de 2026-10-09

Os testes colocados de `Dialog.web.tsx` e `Dialog.foco.web.test.tsx`, os de
`CategoriaDialog.web.tsx` e os previews administrativos protegem comportamento e
composição. A referência visual e o aceite da primeira etapa publicados em
`978ceb` estão em `docs/guides/wave135-base-validation.md`; esta atualização de
ponteiros no clone pós-F não é nova captura, aprovação humana ou prova de
pixels. A validação final de F permanece separada.
