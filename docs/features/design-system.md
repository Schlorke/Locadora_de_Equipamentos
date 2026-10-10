# 🎨 Design System GB Locações 2025

## 📋 Visão Geral

Este documento descreve o **Design System completo** implementado para o projeto
GB Locações, seguindo as melhores práticas de 2025 para desenvolvimento
front-end escalável e consistente.

---

## Tokens de documentos impressos

O entrypoint puro @gb-locacoes/design-tokens/documents conserva cores e medidas
do ofício existente. Cores vêm de primitives.tailwind; geometria A4, margens e
fontes usam pontos (1/72 de polegada), sem conversão para pixels. documentTokens
não altera temas de tela web/native. Rótulos de status e pagamento ficam no
backend. documents.test.ts protege os valores anteriores; PDFKit consome a mesma
fonte nos dois hosts. Paridade HTTP e limites na onda 37 de
[API compartilhada](shared-api-host.md).

## 🧱 Arquitetura do CSS (regras vigentes, 2026-09-30)

Em 2026-10-09, o usuário aceitou a fidelidade da interface. A referência de
paridade foi registrada a partir das 80 capturas JSON existentes (536 estados),
com cópia da referência anterior e dos hashes fora do repositório. Consulte
`tests/visual/README.md` e a entrada 336 para a origem das capturas e os limites
de interação/dispositivo. A classificação de fontes em variantes `.web` e
contratos universais não muda cores, medidas ou comportamento visual.

Conferência local de 2026-10-08: conservar os utilitários históricos de degradê
sRGB e medidas arbitrárias em px quando a canonicalização mudar o resultado. A
entrada 333 registra a restauração em Configurações/WhatsApp. O comparador de
paridade preserva espaços de interpolação diferentes de sRGB; Oklab não pode ser
apagado pela normalização. Fixture e baselines permanecem.

Vale para `packages/frontend`, `packages/ui`, `packages/design-tokens` e o host
`apps/clients/web`. Estado das ondas 5 a 9 (árvore de trabalho sobre o commit
`4b02f52f`, registrada no commit local de 2026-09-30). A referência visual é a
produção (`main`, `eb4c0098`, Tailwind 3.4.17). Histórico: entradas 177 a 179,
194, 195, 200 a 204 e 219 a 223 de `docs/issues/known-issues.md`.

### Onde cada estilo mora

| Estilo                                  | Lugar                                                                                                | Regra                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| De um componente                        | No próprio componente: `packages/ui/src/web` (primitivos) ou a slice dona em `packages/frontend/src` | Classes no JSX ou variante do componente. Nunca uma regra global para ajustar um componente.                                                                     |
| Moldura compartilhada de controles      | `packages/ui/src/web/field.ts`, `trigger.ts` e `focus-ring.ts`                                       | A moldura entra depois do `className` (`cn` de `packages/ui/src/web/cn.ts`): o consumidor muda tamanho e espaçamento, não borda, sombra nem contorno.            |
| Tokens (cor, sombra, medida, `z-index`) | `packages/design-tokens/src/theme.css` e `tokens.css`                                                | Nenhum `:root`/`.dark` fora do design-tokens (`packages/frontend/src/app/index.styles.test.ts`). Valores conferidos com `primitives.ts` em `primitives.test.ts`. |
| Utilitários e variantes próprios        | `packages/frontend/src/app/styles/utilities.web.css` (`@utility`, `@custom-variant`)                 | Sombras dos controles (`shadow-control`, `shadow-raised`...), `controls:` (gatilho com `aria-controls`) e `hover-always:` (hover sem `(hover: hover)`).          |
| Global sem componente dono              | `packages/frontend/src/app/styles/*.web.css`                                                         | Só documento, campos nativos soltos, estrutura sem dono, barras de rolagem, animações e terceiros (`vendor/`).                                                   |

Arquivos de `packages/frontend/src/app/styles` (cada um com uma
responsabilidade, cabeçalho de 1 a 3 linhas e no máximo 300 linhas):

- `globals.web.css`: só a entrada (ordem das camadas, imports dos tokens, da
  paleta, das escalas e dos arquivos, `@config`, ponte `@theme inline` das cores
  dos controles e `@source`). É o `@gb-locacoes/frontend/app/styles.css`; A
  antiga `app/globals.css` da raiz, retirada em F, só o importava. O Storybook
  (`.storybook/preview.tsx`) importa a entrada do frontend desde a onda 135.
- `utilities.web.css`, `outline.web.css` (contorno com a semântica do Tailwind
  3, onda 9), `base.web.css` (documento, `html`/`body`, rolagem suave, cor de
  borda padrão, `h1`–`h3`, `p`, `small`, `section` e o preflight do Tailwind 3),
  `forms.web.css` (campos nativos sem componente), `layout.web.css`,
  `scrollbars.web.css` (barra padrão e as dos painéis), `components.web.css`
  (cartões das seções públicas, página Sobre, imagem do hero),
  `animations.web.css` (keyframes em kebab-case) e `vendor/` (`day-picker`,
  `day-picker-states`, `recharts`, `base-ui`).
- O Tailwind não lê testes nem fixtures: `@source not` para `*.test.*`,
  `*.spec.*` e `__fixtures__` na entrada e negação no `content` do
  `tailwind.config.cjs`, cujo content foi esvaziado com a retirada da raiz no
  clone F. As fontes atuais são os @source compartilhados abaixo.
- Fontes declaradas: `@import 'tailwindcss' source(none)` com `@source` para
  `packages/ui/src`, `packages/frontend/src` e `apps/clients/web/src`; sem a
  detecção automática, o CSS atual não lê `docs/` e `tools/`. A comparação
  histórica com o build da antiga raiz foi encerrada na retirada F; o teste
  `index.styles-build.test.ts` continua caracterizando a entrada do host web.

### Ordem das camadas

- `@layer theme, base, components, utilities;`, sem nenhuma camada depois de
  `utilities` (`index.styles.test.ts`). As classes utilitárias do elemento
  vencem `base` e `components`, como no Tailwind 3 da produção.
- `base`: regras de elemento, inclusive `* { border-color }`, a tipografia de
  `h1`, `h2`, `h3`, `p` e `small` e
  `section { overflow-x: hidden; max-width: 100vw }`. Classe no elemento sempre
  vence; não há exceção por marcador (`data-own-border`, `data-own-type` e
  `revert-layer` saíram na onda 5, entrada 195). O único `revert-layer` aprovado
  desde a onda 9 é o fallback do contorno em `outline.web.css`
  (`outline-style: var(--tw-tw3-outline-style, revert-layer)`), que devolve o
  anel do navegador no foco por teclado quando não há utilitário de estilo
  (`index.styles.test.ts` só o aceita ali; entrada 223).
- `components`: estrutura, terceiros, cartões e a barra de rolagem padrão
  (`* { scrollbar-* }`), que não pode ficar em `base` porque o plugin
  `tailwind-scrollbar` zera `scrollbar-*` no fim dessa camada.
- `data-own-frame` tira um botão da variante `controls:` (moldura de gatilho com
  `aria-controls`): `Button` `filter-reset`/`header-action`, `Cabecalho` e
  `Acoes`.

### Proibido: `!important` e camada de sobrescrita

- `!important` é proibido em CSS, no Tailwind (modificador `!` como prefixo ou
  sufixo, com variantes e em `@apply`) e em estilo inline (inclusive
  `style.setProperty(p, v, "important")`). Em 2026-09-29 o código tem zero
  ocorrências; o CSS do `build:web` só tem o `[hidden]{display:none!important}`
  do preflight do próprio Tailwind.
- `css-important` é regra de tolerância zero do `pnpm tokens`: reprova em todo
  escopo (produto, raiz legada e fonte canônica), sem baseline, sem comentário
  de exceção e, desde a onda 5, sem exceção para
  `@media (prefers-reduced-motion: reduce)`. Também lê o config JS do Tailwind
  (`@config` e `tailwind.config.*` da raiz) e os plugins locais: reprova
  `important: true` ou um seletor e `!important` em `addUtilities` e afins
  (entrada 202). O `stylelint` (`declaration-no-important`) também reprova em
  qualquer `.css` de `packages` e `apps`.
- `jsx-text-escape` (absoluta, escopo do produto): texto de interface com escape
  `\u00XX` em texto JSX ou atributo aparece literal na tela; escreva o caractere
  real (exceção: atributo `pattern`; entrada 203).
- Camada de sobrescrita também é proibida: `overrides` e suas sub-camadas
  (`overrides.normal`, `overrides.forced`) não voltam
  (`css-structure/no-layer-names`, em `@layer` e em `@import ... layer()`).
- Para vencer um estilo: variante no componente, a camada certa, a configuração
  da biblioteca ou uma folha própria depois da dela (caso do Mapa no Shadow DOM,
  entrada 194). Estilo inline gravado por biblioteca se resolve na origem (ref,
  prop ou opção), não com peso.

### Tokens no design-tokens

- `theme.css`: triplas HSL do claro e do escuro (`hsl(var(--x))`), `--radius`,
  `--header-height` e as camadas de sobreposição.
- `z-index` só por token: `--layer-base`, `--layer-step`, `--layer-inset`,
  `--layer-floating`, `--layer-sticky`, `--layer-fab`, `--layer-dropdown`,
  `--layer-popover`, `--layer-dialog-backdrop`, `--layer-dialog`,
  `--layer-tooltip`, `--layer-spotlight` e `--layer-legacy-stack` (o 9999 legado
  do painel, no marcador `[data-stack='legacy']`), mais os apelidos `--z-*`.
- `tokens.css`: cores da marca e de papéis (`--brand`, `--border-strong`,
  `--focus-halo`...), o anel de foco `--focus-ring` (igual a `--brand`,
  `#ea580c`, no claro e no escuro; `--focus-ring-width` e `--focus-ring-offset`
  de 2px), escala `--shadow-*`, `--border-width-*`, `--space-*`, `--rounded-*` e
  a tipografia fluida (`--font-size-h1`, `--line-height-*`...). A ponte
  `@theme inline` da entrada expõe `--color-focus-ring` (`outline-focus-ring`).
- Sem `legacy.css` desde a onda 5: as 19 variáveis com nome de hash viraram
  tokens nomeados (`--text-secondary`, `--header-surface`, `--header-border`,
  `--action-icon`, `--action-hover-surface`, `--action-danger`,
  `--action-danger-hover`, `--action-danger-surface`, `--whatsapp`,
  `--whatsapp-hover`, `--whatsapp-scroll-track`, `--space-4`,
  `--viewport-width`, `--header-offset`) ou passaram a usar tokens que já
  existiam (`--brand`, `--rounded-full`, `--rounded-scroll-thumb`,
  `--line-height-paragraph`). `primitives.test.ts` confere a paridade.
- A barra de rolagem usa `--scroll-thumb`/`--scroll-track`: `--scrollbar-*` é
  nome do plugin `tailwind-scrollbar`.
- `palette.css` (onda 8): a paleta do Tailwind 3.4.17 em hex no `@theme`, no
  lugar do OKLCH do Tailwind 4 (`orange-600` = `#ea580c`). A fonte canônica é
  `primitives.tailwind` (`primitives.ts`), com impressão digital sha256 dos
  valores do 3.4.17; os tons homônimos de `color` apontam para ela
  (`orange600: tailwind.orange600`), porque `pnpm check:tokens` exige uma única
  definição hex por tom. `bg-gradient-to-*` interpola em sRGB, como na produção
  (entrada 219).
- `scales.css` (onda 9, `@theme inline`): as escalas em que o Tailwind 4 mudou o
  valor, com os da produção: `shadow-sm`, `blur-sm`, `drop-shadow-*`,
  `rounded-full`, altura de linha de `text-*`, `outline` e `ring` sem largura
  (`ring` com 3px, azul 500 a 50%) e breakpoints `sm`…`2xl` em px (640 a 1536),
  com os valores em `primitives.ts` (entrada 223).
- O spread de `design-tokens/output/tokens-tailwind.json` saiu do
  `tailwind.config.cjs` (onda 8): `text-base`, `text-small` e `text-h1`–`h3` são
  tamanho de fonte fluido com a altura de linha de `typography.fluid` (entrada
  219). A pipeline do Style Dictionary (`design-tokens/output/*`,
  `style-dictionary.config.js` e os scripts `design-system:*-tokens`) saiu em
  2026-09-30 (entrada 227).
- Estado de erro (onda 8): `--field-invalid` (`#ef4444`), `--field-invalid-halo`
  e `--shadow-control-invalid-focus` em `tokens.css`, com a ponte
  `--color-field-invalid` na entrada (entrada 220).

### Componentes e marcadores

- `Input`, `CurrencyInput` e `SelectTrigger` usam `FIELD_FRAME`; `Textarea`,
  `TEXTAREA_FRAME`; `CustomSelect`, `SearchBar` e `ViewToggle`, as molduras de
  filtro; `Checkbox`, a própria `CHECKBOX_FRAME`.
- Erro de validação é `aria-invalid`, nunca uma borda solta: `FIELD_INVALID`
  fecha `FIELD_FRAME`, `FILTER_FIELD_FRAME` e `TEXTAREA_FRAME` e, com
  `aria-invalid="true"`, pinta a borda `--field-invalid` e, no foco, o halo
  vermelho `shadow-control-invalid-focus`. O `QuoteForm` e o `Bloco` de
  `personalizar-icone` usam o atributo (entrada 220). A moldura continua
  apagando borda, sombra e contorno soltos do consumidor: por isso o
  `focus:border-green-500` do WhatsApp e o marcado em ardósia do Rejeitar não
  valem (nunca valeram na produção; decisão pendente).
- `FIELD_FRAME` e `FILTER_FIELD_FRAME` têm `focus:outline-hidden`: como na
  produção, o campo e o seletor de filtro não mostram o anel do navegador no
  foco (entrada 223).
- Gatilhos de Popover, Collapsible, AlertDialog, Sheet, Drawer, Dialog,
  Accordion, NavigationMenu, DropdownMenu e Menubar usam `TRIGGER_FRAME` ou
  `MENU_TRIGGER_FRAME` (variante `controls:`); menus do cabeçalho,
  `HEADER_MENU_TRIGGER`.
- `Button` ganhou `filter-reset` (reset de filtro: no hover, texto laranja e
  sombra maior; nunca borda laranja nem escala, preso por
  `Button.reset.web.test.tsx`) e `header-action` (ações do cabeçalho público).
  `reset` continua sendo o de restaurar configurações.
- `@gb-locacoes/ui` exporta `FOCUS_RING`, `FILTER_CARD` e `HEADER_MENU_TRIGGER`.
- Anel de foco por teclado, no laranja da marca (decisão do usuário, onda 5):
  `FOCUS_RING` só em `:focus-visible` (2px, `outline-focus-ring`, afastado 2px);
  menus do Radix e o X do `Dialog` e do `Sheet` usam `MENU_FOCUS_RING`, que só
  mostra o anel com `data-input-modality="keyboard"` no `<html>`
  (`trackInputModality`): aberto por clique, o X não mostra anel (entrada 200).
  O foco do Recharts usa `var(--focus-ring)`. Nenhum foco usa mais `--ring`.
  Desde a onda 8 não sobra anel, contorno ou borda laranja própria no foco: os
  anéis `orange-500` (painel das `Tabs`, `HoverActionMenu`, `CategoriaDialog`,
  `email-layout-container`, `Bloco`) e o gatilho do seletor de período passaram
  a `FOCUS_RING`, e a guarda `packages/ui/src/web/focus-ring.test.ts` reprova
  laranja em `:focus`, `:focus-visible` e `:focus-within` (entrada 221). Os
  anéis semânticos (verde do WhatsApp, rosa do `Bloco`) ficam.
- Gatilhos com `TRIGGER_FRAME` mostram, no foco por teclado, o anel `auto` azul
  de 2px do navegador, como na produção (`outline-2` só dá a largura; entrada
  223).
- Regra do foco, também nas cores forçadas (alto contraste do Windows; achado
  128): em repouso e no clique, nenhum contorno em nenhum modo, como na
  produção; no foco por teclado, o anel da marca no modo normal e, nas cores
  forçadas, o contorno de 2px na cor do sistema (lá o sistema apaga sombras e
  halos, e o contorno é a única indicação do foco). O `outline-hidden` grava nas
  cores forçadas um sólido transparente que o sistema pinta; por isso, onde ele
  vale em repouso ou no clique, a largura vai a 0 nesse modo: `MENU_FOCUS_RING`
  (gatilhos e itens de menu, X do `Dialog` e do `Sheet`) e `FILTER_CARD` levam
  `forced-colors:outline-0`, e a caixa de seleção usa `HALO_FOCUS_OUTLINE`
  (`focus:outline-hidden forced-colors:focus:outline-0 forced-colors:focus-visible:outline-2`:
  sem contorno no clique, contorno no Tab; no modo normal, o halo laranja da
  produção, sem anel). As abas e o `CloseButton` usam `FOCUS_RING`, que só
  existe em `:focus-visible`, e o clique nelas não mostra nada. A produção
  apagava o contorno desses componentes com `outline: none !important` também no
  teclado; o contorno no teclado das cores forçadas é diferença aprovada
  (acessibilidade). Trava por elemento, contra o componente da produção:
  `tests/visual/tailwind-parity.test.ts` ("elementos de foco"). Ficam como na
  produção, fora da regra (decisão pendente): os itens de marcação e de opção
  dos menus (`*CheckboxItem`, `*RadioItem`), que no teclado mostram o anel
  padrão do navegador, e o `focus:outline-hidden` do item do `Select` e dos
  botões do `ImageUpload`, que nas cores forçadas desenha também no foco pelo
  mouse.
- Trava de rolagem do Radix: `useReleaseScrollLockRef` (entrada 178), inclusive
  no `Drawer` desde a onda 5 (entrada 200); `InputOTP` e Sonner resolvem o
  estilo inline no próprio componente (entrada 179).
- Casca da plataforma (onda 5): `widgets/casca-plataforma` é a barra com o nome
  provisório da plataforma nas páginas de conta do host `app`
  (`ClientLayoutShell` com `chrome="platform"`). O seletor de locadora do painel
  no web é uma barra (`TenantSelector.web.tsx`) com `Label`, `Select` e
  `Button`. O `Text` do design system grava a altura de linha em px no web desde
  a onda 8 (entradas 204 e 219).

### Revelação por rolagem, movimento reduzido e rolagem suave

- `ScrollRevealInit` não grava `transition` inline nos elementos de
  `CSS_OWNED_TRANSITION` (a transição fica em `components.web.css`) nem
  `overflow` na página Sobre (`html:has(.sobre-page)` em `layout.web.css`). O
  evento `scrollRevealReady` e os tempos não mudaram
  (`docs/features/equipment-3d-carousel.md`).
- Com `prefers-reduced-motion: reduce`, os elementos de
  `STILL_WHEN_REDUCED_MOTION` ficam parados pelo `ScrollRevealInit`, sem regra
  de CSS. Desde a onda 5 eles só nascem escondidos com `motion-safe:` (Hero,
  Categorias, Destaques, Contato e Sobre), então o primeiro quadro sem JS já
  respeita a preferência (entrada 201).
- `slide-in-up` sobe 60 px, como o `slideInUp` da produção (entrada 201).
- Rolagem suave: `html { scroll-behavior: smooth }` em `@layer base`, sem o
  atributo `data-scroll-behavior` nos layouts. O aviso único do Next em dev que
  sugere o atributo é esperado.

### Paridade com a produção (Tailwind 3 × 4)

A migração para o Tailwind 4.3.3 mudou escalas, padrões e a semântica de
utilitários e variantes; as ondas 8 e 9 restauraram a da produção no tema e nas
camadas, sem reescrever consumidor um a um (restauração aplicada por padrão,
aguardando o aval do dono; entradas 219 e 223):

- escalas e cores: `palette.css` e `scales.css` (seção "Tokens no
  design-tokens");
- `utilities.web.css`: `hover:` sem `(hover: hover)` (`hover-always` igual a
  `hover`), um `transform` único para `translate`/`scale`/`rotate`,
  `space-*`/`divide-y` a partir do segundo filho, `text-*` sem `--tw-leading`,
  listas de `transition`, `container` e `justify-self-end`;
- `outline.web.css`: `outline-<n>` só dá a largura; o estilo vem de um
  utilitário de estilo do elemento (`outline`, `outline-solid`, `-dashed`,
  `-dotted`, `-double`, `-none`, `-hidden`, que gravam `--tw-tw3-outline-style`)
  ou, sem ele, do navegador (nada em repouso, anel `auto` no foco por teclado);
  `outline-hidden` grava sólido nas cores forçadas, como o `outline-none` do
  Tailwind 3;
- o preflight do Tailwind 3 em `base.web.css`.

Na onda 135, trinta ocorrências em sete fontes de Configurações/WhatsApp
voltaram aos nomes já registrados na produção: `bg-gradient-to-br/tr` com sRGB,
medidas arbitrárias em px, `leading-[var(--line-height-paragraph)]`,
`text-[var(--text-secondary)]` e `break-words`. Degradês Oklab e escala rem não
são equivalentes aos anteriores. `canonicalGradient` conserva essa diferença;
somente `in srgb` explícito equivale à forma implícita. As ferramentas de
paridade passaram 27 casos, sem nova exceção ou regravação de fixture/baseline.
Os três builds locais foram renovados; a comparação visual completa permanece
separada e pendente (entrada 333).

Classes que o Tailwind 3 não gerava (opacidade fora da escala, como `/6`, `/8`,
`/12` e `/98`, `border-l-3`, `duration-160`, `flex-2`…) eram invisíveis na
produção e saíram do código. Sintaxe que vale daqui em diante:

- `outline-hidden` no lugar de `outline-none`;
- `[var(--x)]` no lugar de `[--x]` ou `(--x)`;
- `[transition-timing-function:…]` no lugar de `ease-[…]` ou `[--tw-ease:…]`;
- a variante responsiva primeiro (`md:after:`, não `after:md:`);
- `[@media(max-width:N)]` no lugar de `max-[N]`;
- `_` no lugar de vírgula em valor arbitrário;
- `/50` no lugar de `ring-opacity-*`.

Trava: `tests/visual/tailwind-parity.test.ts` (em `pnpm test:visual-tools`)
compara cada utilitário e cada cadeia de variantes usados no produto com o valor
da produção gravado em `tests/visual/tailwind-parity/production.json`, em 1440 e
390 px, em repouso, no foco por teclado e por mouse, nas cores forçadas e com a
fonte do navegador em 20px. Classe nova sem valor da produção reprova; exceções
só em `tests/visual/tailwind-parity/exceptions.json`, com motivo (moldura dos
campos, anel de foco laranja, estado de erro `aria-invalid`, `sr-only` com
`clip-path`, especificidade menor de `group-*`/`peer-*`). Como regenerar a
fixture: seção "Paridade com a produção" de `tests/visual/README.md`.

### Trava: `lint:css` e linha de base visual

- `pnpm lint:css` (passo no job `architecture` do CI): `stylelint` com
  `.stylelintrc.json` (`stylelint-config-standard`, `declaration-no-important`,
  `property-no-unknown` sem exceção, classes em kebab-case, desativação só com
  descrição e escopo válido) e o plugin `tools/stylelint-css-structure.mjs`
  (`css-structure/max-lines` 300 e `css-structure/no-layer-names`). Testes em
  `tests/unit/stylelint-css-structure.test.ts`.
- Linha de base visual, pré-requisito de qualquer mudança de CSS: captura do
  estilo computado (`pnpm visual:capture`, 30 arquivos, 478 capturas em 390 e
  1440 px desde a onda 9) e comparação (`pnpm visual:compare`), que só aceita as
  diferenças de `tests/visual/approved-changes.json`. Regravar a linha de base
  só quando a mudança foi pedida. Detalhes em `tests/visual/README.md`.
- Linha de base regravada em 2026-09-29 (onda 5): pelo lote A1, com a cascata da
  produção e o anel laranja (`approved-changes.json` vazio); depois só nos
  arquivos que os lotes A2 (`painel/orcamentos`, `painel/equipamento-novo`) e D2
  (`painel/*`) mudaram de propósito. O harness tem o gancho `check`: os estados
  `dialog-orcamento-aberto` e `dialog-nova-categoria` reprovam se o foco inicial
  tiver contorno.
- Regravada de novo na onda 8 (paleta e tipografia da produção, estado de erro e
  `Text` em px) e na onda 9 (semântica da produção em todas as categorias de
  classe; depois só o estado novo `foco-teclado-categoria`, 478 capturas), cada
  vez com duas capturas de verificação sem diferença. Histórico em
  `tests/visual/README.md`.

---

## 🏗️ Arquitetura Implementada

### ✅ **Ferramentas Essenciais Configuradas**

| Ferramenta    | Status         | Propósito                        |
| ------------- | -------------- | -------------------------------- |
| **Storybook** | ✅ Configurado | Documentação viva de componentes |
| **Storybook** | ✅ Configurado | Documentação e testes visuais    |
| **Stylelint** | ✅ Configurado | Linting de estilos               |
| **CI/CD**     | ✅ Configurado | Automação de testes visuais      |

---

## 🎨 Design Tokens

### **Estrutura de Tokens**

Os design tokens estão organizados seguindo o padrão **DTCG (Design Tokens
Community Group)**:

```
packages/design-tokens/src/  # Tokens canônicos (theme.css, tokens.css, palette.css, scales.css, primitives.ts)
design-tokens/
└── base.json                # Tokens fundamentais; primitives.test.ts confere a paridade
```

Não há etapa de geração: a antiga saída `design-tokens/output/` do Style
Dictionary saiu em 2026-09-30 (entrada 227 de `docs/issues/known-issues.md`).

### **Categorias de Tokens**

1. **Cores** - Paleta completa com primárias, secundárias e semânticas
2. **Tipografia** - Fontes, tamanhos, line-heights e letter-spacing
3. **Espaçamento** - Sistema de spacing consistente
4. **Border Radius** - Valores de bordas arredondadas
5. **Sombras** - Sistema de elevação
6. **Animações** - Durações e easings

### **Comandos de Tokens**

```bash
# Gate de tokens de design (valores crus, z-index, !important)
pnpm tokens

# Prova de propagação dos tokens
pnpm check:tokens
```

---

## 📚 Storybook

### **Estrutura Organizada**

```
stories/
├── foundations/          # Design tokens (1 story)
├── atoms/               # Componentes UI (50+ stories)
├── molecules/           # Componentes moleculares
├── organisms/           # Componentes organizacionais (15+ stories)
├── admin/               # Componentes administrativos (10+ stories)
└── templates/           # Templates de páginas
```

### **Addons Configurados**

- ✅ **@storybook/addon-docs** - Documentação automática
- ✅ **@storybook/addon-a11y** - Testes de acessibilidade
- ✅ **@storybook/addon-vitest** - Integração com testes
- ✅ **@storybook/test-runner** - Testes automatizados

### **Comandos Storybook**

```bash
# Desenvolvimento
pnpm design-system:storybook

# Build para produção
pnpm design-system:build

# Build do Storybook
pnpm design-system:publish
```

---

## 🔍 Storybook (Documentação e Testes Visuais)

### **Configuração Atual**

O Storybook está configurado para:

- ✅ **Desenvolvimento Local** - `http://localhost:6006`
- ✅ **Build Estático** - Gera documentação para deploy
- ✅ **Testes Visuais** - Integração com Vitest
- ✅ **Acessibilidade** - Addon a11y configurado

### **Comandos Disponíveis**

```bash
# Desenvolvimento local
pnpm storybook

# Build para produção
pnpm build-storybook

# Testes do Storybook
pnpm test:storybook
```

O build estático P1 da onda 135 passou em Node 24.21.0, com saída externa,
ambiente sintético, modo `legacy` e telemetria desligada. O catálogo gerado
contém 172 entradas: 156 stories e dezesseis páginas de documentação.
`index.html`, `iframe.html` e `index.json` têm bytes/SHA-256 conferidos no
resumo local de empacotamento. Essa prova confirma geração do catálogo;
navegação, aparência, acessibilidade e testes das stories exigem verificações
próprias.

### **Setup Necessário**

1. **Desenvolvimento**: `pnpm storybook` para desenvolvimento local
2. **Build**: `pnpm build-storybook` para gerar documentação estática
3. **Testes**: `pnpm test:storybook` para executar testes visuais

---

## 🧹 Stylelint

### **Configuração**

O Stylelint está configurado para:

- ✅ **TailwindCSS** - Suporte completo
- ✅ **CSS/SCSS** - Linting de estilos
- ✅ **Regras customizadas** - Consistência do projeto

### **Comandos de Linting**

O gate do CSS do produto é `pnpm lint:css` (seção "Arquitetura do CSS").

```bash
# Lint completo (ESLint + Stylelint)
pnpm design-system:lint

# Auto-fix
pnpm design-system:lint:fix
```

---

## 🔧 Scripts PNPM

### **Comandos Disponíveis**

```bash
# Design Tokens
pnpm tokens                        # Gate de tokens de design
pnpm check:tokens                  # Prova de propagação dos tokens

# Storybook
pnpm design-system:storybook       # Desenvolvimento
pnpm design-system:build           # Build
pnpm design-system:publish         # Build do Storybook

# Qualidade
pnpm design-system:lint            # Lint completo
pnpm design-system:lint:fix        # Auto-fix
```

---

## 🧩 Componentes Base

- `Button` (`packages/ui/src/web/Button.web.tsx`) mantém variantes documentadas
  e agora oferece o tamanho `compact` (`size="compact"`) para ações densas em
  dialogs e grupos de opções. Utilize-o quando precisar de CTAs com 32 px de
  altura e texto `text-xs` em mobile, preservando os mesmos estados de hover
  padronizados.

---

## 🚀 Workflow de Desenvolvimento

### **1. Desenvolvimento de Componentes**

```bash
# 1. Iniciar Storybook
pnpm design-system:storybook

# 2. Desenvolver componente
# 3. Criar/atualizar story
# 4. Testar acessibilidade
# 5. Commit e push
```

### **2. Atualização de Design Tokens**

```bash
# 1. Editar os tokens em packages/design-tokens/src (e design-tokens/base.json,
#    que primitives.test.ts compara com primitives.ts)
# 2. Conferir
pnpm tokens
pnpm check:tokens

# 3. Verificar mudanças no Storybook
pnpm design-system:storybook

# 4. Commit e push
```

### **3. Visual Regression Testing**

```bash
# 1. Push para branch
# 2. Storybook build roda automaticamente
# 3. Revisar mudanças visuais
# 4. Aprovar ou rejeitar
```

---

## 📊 Métricas de Qualidade

### **Cobertura Atual**

- ✅ **100% dos componentes** documentados no Storybook
- ✅ **70+ stories** organizadas por categoria
- ✅ **Zero violações** de acessibilidade
- ✅ **Build time** < 15s
- ✅ **Responsividade** 100%

### **Testes Automatizados**

- ✅ **Acessibilidade** - addon-a11y
- ✅ **Visual Regression** - Storybook
- ✅ **Linting** - ESLint + Stylelint
- ✅ **TypeScript** - Type checking

---

## 🎯 Integração com IA

### **Contexto para IAs**

O Design System está estruturado para que **IAs possam entender**:

1. **Design Tokens** - Valores consistentes em JSON
2. **Componentes** - Documentação completa no Storybook
3. **Padrões** - Regras de linting e estrutura
4. **Exemplos** - Stories com casos de uso

### **Evitando Alucinações**

- ✅ **Tokens centralizados** - IAs usam valores reais
- ✅ **Documentação viva** - Sempre atualizada
- ✅ **Linting rigoroso** - Bloqueia estilos fora do padrão
- ✅ **Testes visuais** - Detecta mudanças não intencionais

---

## 🔄 Próximos Passos

### **Curto Prazo (1-2 semanas)**

1. **Configurar Storybook** - Executar build e deploy estático
2. **Revisar Stories** - Customizar exemplos específicos
3. **Adicionar Interações** - Usar addon-interactions
4. **Testes de Responsividade** - Verificar breakpoints

### **Médio Prazo (1 mês)**

1. **Templates de Páginas** - Stories para páginas completas
2. **Testes E2E** - Integrar com Playwright
3. **Performance** - Otimizar build e carregamento
4. **Documentação Zeroheight** - Portal público (recomendação)

### **Longo Prazo (3 meses)**

1. **Design System Mature** - Evoluir para DS completo
2. **Componentes Customizados** - Específicos do domínio
3. **Integração Figma** - Sync com design tokens
4. **Documentação Interativa** - Guias de uso

---

## 📚 Recursos Adicionais

### **Documentação**

- [Storybook README](./STORYBOOK_README.md)
- [Admin Design System](./ADMIN_DESIGN_SYSTEM.md)
- [Storybook Implementation Report](./STORYBOOK_IMPLEMENTATION_REPORT.md)

### **Ferramentas**

- [Storybook](https://storybook.js.org/) - Documentação e testes visuais
- [Storybook](https://storybook.js.org/) - Component documentation
- [Zeroheight](https://zeroheight.com/) - Design system documentation
  (recomendação)

---

## 🎉 Conclusão

O **Design System GB Locações 2025** está **100% implementado** com:

- ✅ **Ferramentas modernas** e atualizadas
- ✅ **Automação completa** de qualidade
- ✅ **Documentação viva** e sempre atualizada
- ✅ **Integração com IA** para desenvolvimento eficiente
- ✅ **Visual regression testing** para evitar regressões
- ✅ **Linting rigoroso** para consistência

**Status**: ✅ **IMPLEMENTAÇÃO CONCLUÍDA** **Data**: Dezembro 2024 **Versão**:
1.0.0

### Tokens de relatórios financeiros (2026-10-02)

O entry puro @gb-locacoes/design-tokens/documents mantém também as quatro cores
de status do calendário e os valores existentes de PDF/XLSX financeiros. Cores,
fontes e margens de impressão preservadas; nenhuma tela foi redesenhada.
Comparação com renderer anterior, relógio fixo e 45 linhas: PDF/CSV idênticos
byte a byte e modelo das quatro abas XLSX idêntico com estilos e impressão.
Quatro testes de tokens passaram. Ver onda 38 de
[API compartilhada](shared-api-host.md).

### Rótulo acessível do Button nativo (2026-10-03)

O contrato aceita aria-label opcional. Button.native preserva o rótulo
explícito, inclusive em botões só com ícone, e usa o texto dos filhos como
fallback quando ele não é fornecido. Variantes, estilos e comportamento web
conservados. Teste renderizado nativo e lint/gates aprovados; leitor de tela em
aparelho ainda exige aceite. Ver [onda 74](shared-api-host.md).
