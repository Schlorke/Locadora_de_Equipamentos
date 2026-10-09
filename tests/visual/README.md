# Linha de base visual do web

Rede de segurança da refatoração de CSS: grava, antes da refatoração, o estilo
computado de cada elemento visível do host `apps/clients/web` e compara qualquer
execução posterior com essa gravação. Screenshots são só apoio (ficam fora do
versionamento).

## Como rodar

```bash
# 1. Captura (sobe o backend simulado e o `next dev` nas portas 3100/3101)
pnpm exec playwright test -c tests/visual/playwright.visual.config.ts
#    saída em .tmp/visual/current (VISUAL_OUT=<pasta> muda o destino)

# 2. Comparação com tests/visual/baseline (sai 1 se houver diferença não aprovada)
node tools/visual-baseline/compare.mjs
#    --current <pasta>, --baseline <pasta>, --approved <arquivo>, --json

# Testes das ferramentas (sem navegador)
pnpm exec vitest run --config tests/visual/vitest.config.ts
```

Regravar a linha de base
(`node tools/visual-baseline/compare.mjs --write-baseline --current <pasta>`) só
quando a mudança visual foi pedida; para uma mudança pontual, prefira registrar
a aprovação em `approved-changes.json` com o motivo.

## Histórico da linha de base

| Data       | Origem                                | Motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :--------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-26 | onda 3 (`be859915`)                   | Primeira gravação, antes da refatoração de CSS. Já trazia a regressão de cascata da migração ao Tailwind 4 (entrada 195 de `docs/issues/known-issues.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-09-29 | `4b02f52f` + lote A1 (onda 5)         | Restauração da cascata da produção (`main`, `eb4c0098`, Tailwind 3.4.17): cor de borda padrão, títulos, parágrafos, textos pequenos e seções na camada `base` e a barra de rolagem padrão em `components`, sem a camada `legacy` nem os marcadores `data-own-border`/`data-own-type`; anel de foco por teclado no laranja da marca (token `--focus-ring`), decisão do usuário. `approved-changes.json` esvaziado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-29 | lote A2 (onda 5)                      | Regravados só `painel/orcamentos` e `painel/equipamento-novo` (390 e 1440); os demais arquivos saíram iguais byte a byte. Orçamentos: o X do diálogo aberto por clique deixa de mostrar o anel, porque o anel do foco inicial dos diálogos (Dialog e Sheet) segue a modalidade de entrada, como nos menus; o estado `dialog-orcamento-aberto` passou a exigir isso (`check`). Equipamento novo: acentuação corrigida nos rótulos da seção de especificações ("Especificações Técnicas"), só o texto gravado nas capturas; o estilo é idêntico.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-29 | lote D2 (onda 5)                      | Seletor de locadora compacto: regravados só os oito cenários `painel/*` (390 e 1440); vitrine e `/catalog` saíram iguais byte a byte. O seletor do topo do painel virou uma barra de 53 px (rótulo "Locadora" ligado ao seletor, pergunta do `?locadora=` e erro na mesma barra), no lugar do bloco de 466 px. Duas diferenças de estado fora da barra são só da posição do ponteiro, que fica onde o clique ou o toque aconteceu e agora cai sobre outro elemento porque o conteúdo subiu: `painel/configuracoes` 1440 (`secao-redes-sociais`, sombra de hover do campo de telefone) e `painel/categorias` 390 (`dialog-nova-categoria`, botões de visual da categoria revelados); com a barra forçada à altura antiga, as duas voltam ao valor anterior. As páginas de conta do host `app` (casca da plataforma) não estão na captura.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-29 | lote fech-css (onda 8)                | Regravada inteira (30 arquivos) com a paleta e a tipografia da produção (`main`, `eb4c0098`, Tailwind 3.4.17). Paleta: os tons do Tailwind 3 em hex no `@theme` de `packages/design-tokens/src/palette.css`, no lugar do OKLCH do Tailwind 4; o laranja da marca volta a `#ea580c` (era `#f54a00`) e cada cor de texto, fundo, borda, ícone e sombra passa ao hex do mesmo tom (conferido tom a tom contra a gravação anterior: 5324 valores trocam do OKLCH para o hex do mesmo tom e 3522 só mudam de notação). Degradês `bg-gradient-to-*` interpolados em sRGB, como na produção (sem `in oklab`). `text-base` e `text-small` voltam a ser tamanho de fonte fluido com altura de linha 1,6 e 1,5 (o spread de `design-tokens/output/tokens-tailwind.json` no `tailwind.config.cjs` os registrava como cor): títulos dos cartões de destaque da home de 36 para 18 px, abas das categorias, campos e botões com `text-base`; o deslocamento do CTA animado acompanha a largura nova do texto. Estado de erro dos campos por `aria-invalid`: receita `Form`, estado `invalid`, com borda `#ef4444`. `Text` do design system com altura de linha em px (era 24 vezes a fonte, 384 px): o texto de apoio das receitas do `/catalog` encolhe e menus, dicas, gaveta e popover abertos sobem 360 px. O anel de foco unificado no token `--focus-ring` (painel das abas, `HoverActionMenu` e outros) não aparece nos estados capturados. `url()` passou a ser gravado sem a origem (`support/capture.ts`); capturas nas portas 3120/3121 (`VISUAL_WEB_PORT`/`VISUAL_BACKEND_PORT`) e o campo informativo `url` do cabeçalho escrito com a porta padrão 3100. Duas capturas seguidas de verificação contra a nova gravação: 0 diferenças. |
| 2026-09-29 | lote css-paridade (onda 9)            | Regravada inteira (30 arquivos, 6254 valores) com a semântica da produção (`main`, `eb4c0098`, Tailwind 3.4.17) em todas as categorias de classe, provada por `tailwind-parity.test.ts`. Raio de `rounded-full` 9999px (2444 valores; o 4 gravava `calc(infinity * 1px)`); cursor de mão em `button`/`[role=button]` (856, preflight do 3); margens de `space-*` a partir do segundo filho e com a especificidade do 3, que vence a margem própria do filho (1959, ex.: o aviso do formulário de contato com `-mt-2` passa a 16 e 24 px); `transform` único de translate/scale/rotate (452; a captura passou a gravar também `translate`, `scale` e `rotate`); `backdrop-blur-sm` e `blur-sm` 4px e `drop-shadow-*` do 3 (234); `shadow-sm` `0 1px 2px 0 rgb(0 0 0 / 0.05)` (139); altura de linha de `text-*` responsivo que vence `leading-*` (32, ex.: título do hero de 75 para 60 px); sobreposições dos cabeçalhos e `bg-yellow-400/8` sem as classes inertes na produção (60 degradês e fundos); campos com o fundo do navegador e seletor de cor com `buttonface`; `hover:` sem `(hover: hover)` (estados de hover a 390 px mudam de cor); `after:md:` na `Sidebar` (47 elementos entram ou saem, os demais pela posição do ponteiro depois das margens novas). Duas capturas seguidas de verificação contra a nova gravação: 0 diferenças.                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-30 | lote css-paridade, 2ª rodada (onda 9) | Estado novo `foco-teclado-categoria` em `painel/equipamentos` (390 e 1440): o seletor da barra de filtros focado pelo teclado, com borda azul e halo e sem o anel do navegador, como na produção (com `focus:outline-hidden` retirado da moldura do filtro, o estado grava o anel `auto`). Os outros 28 arquivos saíram iguais byte a byte: a correção do contorno (`outline-<n>` só dá a largura; no foco por teclado, o anel `auto` do navegador nos gatilhos com `aria-controls`, como na produção) e os breakpoints `sm`…`2xl` em px não mudam nenhum estado já capturado, porque nenhum foca pelo teclado um gatilho com `aria-controls` nem muda a fonte do navegador. Essa prova fica em `tailwind-parity.test.ts`. Duas capturas seguidas de verificação contra a nova gravação: 0 diferenças.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-07 | onda 134, lote vitrine-conteúdo (B0)  | Cenários novos gravados antes da troca dos textos legais e das páginas legais na pausa: `vitrine/termos`, `vitrine/privacidade`, `vitrine/politica-devolucao`, `vitrine/cookies` e `vitrine/site-pausado` (locadora `loc-p` com o cartão em pausa, 503 esperado; `support/env.mjs`, `fixtures.mjs` e `mock-backend.mjs` com os cabeçalhos do modo do site). Só esses 10 arquivos (390 e 1440) foram copiados para a linha de base; os outros 30 não mudaram. Duas capturas seguidas dos cenários novos: 0 diferenças (2740 elementos). A Sobre não entra: o carrossel 3D dela é importado direto (sem `next/dynamic`) e o harness nunca responde os chunks de three.js, então o `load` não dispara; a referência dela fica na marcação estática de `55763c1e` (`tests/unit/__fixtures__/vitrine-gb/sobre.markup.html`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-07 | onda 134, lote vitrine-conteúdo (B11) | Fixture com o conteúdo institucional e os textos legais da GB (`siteContent` com a frota da produção, 200, `legalDocuments` e a rota do documento no backend simulado; `support/fixtures.mjs`): a vitrine voltou a ser a da produção, e saíram as aprovações da onda 132 da home, do contato e do subtítulo de anos do detalhe; as da linha da nota do detalhe ficaram com o motivo D-A. Entraram as aprovações do aviso do mapa no cartão "Onde estamos" do contato, dos links legais no rodapé da pausa, do rodapé do `/catalog` sem locadora e das seções novas de `painel/configuracoes` (botões e estados `secao-horario`, `secao-conteudo`, `secao-compromissos` e `secao-textos-legais`; o painel não foi regravado porque a linha de base dele já diverge pela moldura administrativa de outro lote, entrada 295). Cenário novo `vitrine/termos-pausado` (Termos em pausa, 200, na moldura neutra): só esses 2 arquivos (390 e 1440) copiados para a linha de base. Duas capturas completas seguidas (portas 3342/3343) com as mesmas pendências; na vitrine, só o orbe do terceiro cartão de "Por que escolher" (o atraso do pulso gravado numa troca de posição do cartão, corrigido em `ScrollStackBenefitCard.web.tsx`; a home recapturada sem diferença). Na segunda rodada (linha seguinte), a fixture passou a ser a GB sem a frota (D-B), e o selo e o número de frota saíram com aprovação D-B.                                                                                                                                                                                                                                                                                                                      |
| 2026-10-07 | onda 134, vitrine-conteúdo, 2ª rodada | Fixture sem a frota (`siteContent` exatamente como o `tools/gb-site-settings.mjs` grava para a GB; D-B, decisão do dono de 2026-10-07: a frota fica de fora até o dono preencher "Equipamentos na frota" no painel, nem 200 nem 50). Na vitrine, só dois pontos mudam: o hero perde o selo "+200 Equipamentos Disponíveis" (só a 1440, porque a 390 o esconde; o selo de anos e a moldura animada sobem uma posição) e o topo do contato perde o número "50+ Equipamentos Disponíveis" (o "24h Suporte Técnico" sobe uma posição). Entraram 48 aprovações por elemento, com os valores exatos e o motivo D-B, em `approved-changes.json`; a linha de base não foi regravada. Duas capturas completas seguidas (portas 3342/3343, só `visual-baseline.spec.ts`), com os 42 arquivos iguais byte a byte (na segunda, o `390 vitrine/home` estourou o `page.goto` no primeiro carregamento do `next dev` e foi recapturado sozinho): vitrine e `/catalog` sem diferença pendente e nenhuma aprovação sem uso. O painel ficou com as mesmas diferenças da moldura administrativa de outro lote (entrada 295), sem nenhuma nova.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-07 | onda 134, números no hero             | Lote dos números no hero (`fix:contato-separador`): o SSR do hero passou a levar o telefone e o WhatsApp da locadora, e hero e cabeçalho mostram só os números presentes, com o separador só entre os dois; sem nenhum, o bloco sai. Entraram 10 aprovações por elemento, com os valores exatos e o motivo da regra do separador, em `approved-changes.json`: o bloco do telefone da barra do topo do cabeçalho do `/catalog`, que o monta sem locadora (6 elementos a 1440 e 4 a 390, de presente para ausente). Não são paridade com a produção: lá o cabeçalho tinha os números da GB por padrão, o que o T12 hoje proíbe. Na home, a fixture tem os dois números e o hero passou a mostrá-los; só o texto dos links muda, e o comparador não compara texto, então não houve aprovação. No reparo do lote (no celular, sem WhatsApp, o telefone no lugar do ícone sozinho), a linha de base não muda, porque a fixture tem o WhatsApp. A linha de base não foi regravada. Duas capturas completas seguidas do reparo (portas 3320/3321), iguais entre si e às do lote: vitrine e `/catalog` sem diferença pendente e nenhuma aprovação sem uso; o painel com as mesmas diferenças da moldura administrativa (entrada 295). O `painel/dashboard` variou entre execuções (a região "Locadora do painel" e o seletor ora presentes, ora não) e foi recapturado sozinho.                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-08 | onda 135, lote A (A9)                 | Cenários que faltavam (E21 do plano de aposentadoria da raiz): `conta/*` (área do cliente com a moldura do host web, sessão de cliente), `acesso/*` (telas de conta do host `app`) e nove telas do painel (`painel/email`, `logistica`, `manutencao`, `permissoes`, `whatsapp`, `assinatura`, `equipamento-detalhe`, `equipamento-editar` e `orcamento-detalhe`), com as fixtures novas em `support/fixtures.mjs` e a sessão por cenário (`session` em `support/scenarios.ts`). Só esses 38 arquivos (390 e 1440) entraram na linha de base; os 42 antigos não foram regravados. Duas capturas completas seguidas (portas 3320/3321, só `visual-baseline.spec.ts`; o `390 vitrine/home` estourou o `page.goto` no primeiro carregamento do `next dev` nas duas e foi recapturado sozinho): iguais entre si (80 arquivos, 0 diferenças, 9232 elementos nos cenários novos). Contra a linha de base, os cenários novos e a vitrine saem sem diferença pendente; o painel antigo continua só com as diferenças da moldura administrativa (entrada 295), as mesmas 16281 da parte 1 do lote, sem aprovação nova. A Sobre continua fora (o carrossel 3D importado direto).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## O que é capturado

- Vitrine em `loc-a.localhost:3100`: `/`, `/equipamentos`,
  `/equipamentos/eq-betoneira-400`, `/orcamento` (com um item no carrinho),
  `/contato`, `/entrar`, `/termos`, `/privacidade`, `/politica-devolucao` e
  `/cookies`; a pausa em `loc-p.localhost:3100/` (503, S13) e os Termos em pausa
  em `loc-p.localhost:3100/termos` (200, moldura neutra; onda 134). A `/sobre`
  não entra (limite aceito): o host importa o carrossel 3D direto e o `load`
  nunca dispara; a referência dela é a marcação de `55763c1e` (histórico, onda
  134, B0).
- Painel em `app.localhost:3100` (sessão ADMIN simulada): `/admin/dashboard`,
  `/admin/equipamentos`, `/admin/equipamentos/novo`, `/admin/orcamentos`,
  `/admin/rentals`, `/admin/financeiro`, `/admin/settings` (com as seções de
  horário, conteúdo do site, compromissos e textos legais nos estados
  `secao-horario`, `secao-conteudo`, `secao-compromissos` e
  `secao-textos-legais`, aprovados como capturas inteiras: sem esses estados na
  linha de base, o `compare.mjs` não compara nenhum elemento deles, e o conteúdo
  das quatro seções fica sem referência visual até o painel ser regravado; por
  elemento, só as diferenças dos estados antigos vindas dos botões novos da
  barra de seções; histórico, onda 134, B11), `/admin/categorias`.
- Cenários que faltavam (onda 135, lote A, A9; E21 do plano de aposentadoria da
  raiz), só a página, sem estados:
  - área do cliente em `loc-a.localhost:3100` com a sessão de uma cliente
    (`session: 'client'` do cenário; vínculo CLIENT pela
    `/api/auth/organizations/current`): `/area-cliente`, `/perfil`,
    `/enderecos`, `/historico`, `/historico/rental-visual-2` e `/notificacoes`,
    na moldura da área do cliente (`AccountLayoutShell`, A5);
  - telas de conta do host `app` com visitante: `/login`, `/recuperar-senha`,
    `/reset-password?token=visual-token` e `/comecar` (cadastro de locadora
    fechado, `mode: 'off'`, como na produção hoje);
  - painel: `/admin/email` (Zoho não conectado), `/admin/logistics`,
    `/admin/maintenance`, `/admin/permissions`, `/admin/whatsapp`,
    `/admin/assinatura` (a persona ADMIN não é dona: 403 do `OWNER_REQUIRED`),
    `/admin/equipamentos/eq-betoneira-400`, `.../editar` e
    `/admin/orcamentos/quote-visual-1`. Gravados com a moldura do painel
    (`AdminLayoutShell`, entrada 295); o sino do cabeçalho do painel pede
    `GET /api/client/notifications`, que segue sem fixture (registrado em
    `unmappedApis`) para não mudar as capturas antigas do painel.
- Laboratório `/catalog`: todas as receitas de `packages/ui/src/catalog.ts` em
  todos os estados.
- Viewports 390 px (toque) e 1440 px; estados interativos por rota (foco por
  teclado, hover, abas, select/dropdown/calendário abertos, diálogos, checkbox e
  switch, toast, janela do WhatsApp, menu móvel) em `support/scenarios.ts`.

Propriedades (valores iniciais omitidos; herdadas só onde mudam): cor, fundo,
bordas, raios, sombras, outline, padding/margin, gap, fonte/tamanho/peso/altura
de linha/espaçamento, display/posição/deslocamentos/z-index/overflow, opacidade,
transform (e `translate`, `scale`, `rotate`, que o Tailwind 4 usa no lugar de
`transform`), filtros, cursor, `accent-color`, scrollbar, `fill` e `stroke`,
além de `::before`, `::after` e `::placeholder`. Deslocamentos, margens e
paddings entram pelo valor computado (`auto`, `5%`, `16px`), não pelo valor
medido no layout; deslocamentos que o JavaScript grava no `style` do elemento
(legendas e tooltips de gráfico, popovers) ficam de fora. Elementos sem caixa,
com `visibility: hidden` ou inteiros antes do início do documento não são
visíveis e não entram.

A linha de base do painel foi gravada antes de o host `apps/clients/web` montar
a moldura administrativa (`AdminLayoutShell` com `widgets/menu-admin`, entrada
295 de `docs/issues/known-issues.md`): ela não tem a sidebar, e as capturas
atuais do painel divergem por essa moldura até o lote dela regravar o painel. A
primitiva `Sidebar` entra pela receita do `/catalog` (estados `open` e
`collapsed`).

## Determinismo

- APIs do navegador atendidas por `page.route` e leituras do servidor (SSR) pelo
  backend simulado, ambos com `support/fixtures.mjs`; nenhum banco, rede externa
  bloqueada.
- Só na captura de produção (`VISUAL_CAPTURE_MODE=production`), o prefetch RSC
  explícito do Next é abortado de fato: GET local do tipo fetch, sem navegação,
  fora de `/api` e `/_next`, com `rsc: 1` e `next-router-prefetch: 1`.
  `support/prefetch.mjs` reconhece esse contrato; os abortos ficam nas anotações
  `aborted-prefetch`, só com pathname e nomes dos headers. O tracker permanece
  esperando `requestfailed`, sem ignorar requisições pendentes por `?_rsc`.
  Navegações, RSC direto e variantes sem esses dois headers continuam sujeitos à
  espera e às asserções originais. No desenvolvimento, o filtro fica inativo; o
  Next só faz prefetch automático em produção. Não é uma prova de prefetch ou de
  navegação do produto; as jornadas reais têm seus próprios critérios.
- Relógio fixo (`2026-03-10T15:00Z`) e pausado; avança em passos de 500 ms só
  quando a página parou (rede ociosa, animações encerradas, DOM sem mutações).
- `prefers-reduced-motion: reduce`, `Math.random` com semente e animações
  CSS/WAAPI encerradas antes de cada passo; matrizes de `transform` com 3 casas
  decimais.
- As respostas de API só saem com as fontes da página carregadas: medições de
  texto nunca usam a fonte de fallback.
- Carrossel 3D preso no placeholder: os chunks de three.js nunca são respondidos
  (o componente não é alterado). Em `VISUAL_CAPTURE_MODE=production`,
  `support/heavy-chunks.mjs` deriva os caminhos exatos do import dinâmico do
  Hero pelos manifests do build, sem reconhecer nomes hash por substring.
  Declare `VISUAL_PRODUCTION_BUILD_ID` igual ao build e gere
  `VISUAL_HEAVY_CHUNKS_REPORT` antes do Playwright, fora do repositório e da
  pasta de capturas. O relatório conserva hashes dos inputs; sua reutilização
  exige os mesmos inputs. Mantenha fontes e build congelados. Arquivos ausentes
  ou compartilhados com JS inicial das demais rotas fazem o helper falhar. A
  única exclusão é o manifest exato de `/sobre`, já fora de `SCENARIOS`;
  adicionar essa rota exige revisar o bloqueio. No desenvolvimento, permanece o
  reconhecimento anterior por `three`/`drei`. Essa captura de estilos com
  placeholder não substitui a prova temporal real do carrossel (A10) nem as
  jornadas de sessão, carrinho e orçamento no navegador (J1).
- A navegação aguarda `domcontentloaded`: o import 3D deliberadamente pendente
  pode bloquear `window.load`. A prontidão continua exigindo rede ociosa para
  todos os demais recursos, `document.fonts.ready`, animações encerradas e DOM
  estável, com os passos explícitos do relógio e a asserção do status HTTP. A
  espera de rede integral é de 180s. `VISUAL_DIAGNOSTICS=1` reduz essa espera
  para 20s somente em piloto explicitamente parcial; o wrapper exige filtro de
  testes para habilitá-la. Um piloto, inclusive com receitas limitadas, nunca
  constitui aceite visual integral, aprovação de diferença ou nova baseline.
- Estados partem de uma navegação nova e gravam só o que mudou em relação à base
  da mesma rota, no mesmo tempo de relógio.
- Um estado pode exigir uma condição da página já parada, antes da captura e sem
  avançar o relógio (`check` em `support/scenarios.ts`): os diálogos abertos por
  clique (`painel/orcamentos` e `painel/categorias`) falham se o foco inicial
  mostrar anel, que é só do teclado.
- Verificação: duas capturas seguidas comparadas com a linha de base, 0
  diferenças.
- Editar arquivos do app durante a captura faz o `next dev` recompilar
  (`✓ Compiled in …` no log) e pode reiniciar o estado da página no meio de um
  cenário. Um cenário que falhar ou diferir junto de uma recompilação é
  recapturado sozinho (`--grep "<viewport> .*<cenário>"`, outro `VISUAL_OUT`)
  antes de qualquer conclusão. Uma falha de rede isolada do Windows
  (`net::ERR_NO_BUFFER_SPACE` no `page.goto`) também é recapturada sozinha.
- Valores com `url()` são gravados sem a origem (esquema, host e porta): a
  captura não depende da porta do servidor (`VISUAL_WEB_PORT`). O campo `url` do
  cabeçalho de cada arquivo é só informativo e não é comparado.

### Continuidade local da onda 135 — 2026-10-08, sem commit

`parseCatalogRecipeFilter` trata variável ausente, vazia, só com espaços ou
vírgulas como ausência de filtro; nomes preenchidos são separados por vírgula e
aparados. Antes de gravar um catálogo sem filtro, `assertFullCatalogCaptures`
exige as chaves exatas das 70 receitas/186 estados canônicos mais `base`: 187
capturas por viewport. O integrador executou as ferramentas visuais: 93 testes
em seis arquivos passaram; esse resultado não é aceite visual.

A evidência final compõe 78 páginas de uma execução e dois catálogos completos
de outra: 80 JSON, 536 seções e 536 screenshots, contra 528 seções na
referência. Os oito extras são os quatro estados novos de Configurações por
viewport, aprovados anteriormente como presença de seção, sem comparação
individual do conteúdo interno. São duas execuções combinadas, não uma execução
integral única nem prova de repetibilidade atual. A tabela histórica e suas APIs
não mapeadas descrevem as capturas daquela época.

O comparador terminou com 16.272 pendências: 16.260 nos oito cenários antigos do
painel e 12 diferenças literais de serialização `to right`/`90deg` em
`background-image` fora deles; 372 registros aprovados e sete aprovações D-A sem
uso no estado `checkbox-fins-de-semana` do detalhe a 390. As nove telas novas A9
do painel já têm a moldura na referência; não recebem dispensa genérica pela
entrada 295. Contagens de estilos/presença não são pixels nem aprovação em
bloco.

O JPG `Dialog--open.jpg` a 390 é byte a byte igual aos dois históricos f1/f2
(SHA-256 `CB4A7E307978BDD1C5208BD77F44B6DFC69024B4E7A708C2A9C3AA6B2E267557`),
mas mostra overlay sem caixa perceptível. Uma sonda externa executou quatro
condições de clock/animação: rolar o marcador após abrir afastou o viewport
visual da caixa estável. O JSON scoped inclui o portal sem provar percepção nos
390×844 da imagem; interseção com innerWidth/Height ampliados não basta. A causa
do layout viewport de 1560×3376 ainda não foi demonstrada. Esse JPG e a sonda
não certificam diálogo usável nem aprovam a comparação; detalhes e limites na
entrada 335 de known-issues.md.

## Paridade com a produção (Tailwind 3.4.17)

`tailwind-parity.test.ts` (roda em `pnpm test:visual-tools`, sem navegador)
confere que cada utilitário e cada cadeia de variantes usados no código do
produto dão ao elemento o estilo que a produção (`main`, `eb4c0098`, Tailwind
3.4.17 com o `tailwind.config.cjs` e o `app/globals.css` da `main`) dava:

- o CSS global atual (`packages/frontend/src/app/styles/globals.web.css`,
  compilado como o `build:web`) é resolvido por `support/tailwind-parity.mjs`,
  um motor de cascata pequeno (camadas, especificidade, `revert-layer`, `var()`
  com fallback, `@property`, `@media` a 1440 e 390 px, contorno nas cores
  forçadas, foco por teclado e por mouse com o anel de foco do navegador do
  `:focus-visible` e a fonte do navegador em 20px) que normaliza os valores
  (cores em sRGB, `calc`, `rem` em px, sombras e degradês); nas media queries o
  `rem` fica `rem` (48rem e 768px só coincidem com a fonte em 16px);
- o valor da produção de cada classe fica em `tailwind-parity/production.json`,
  com o controle (o mesmo elemento sem a classe) de cada caso; diferença que o
  controle também tem é do preflight, não da classe;
- também confere as combinações que dependiam da ordem entre classes
  (`leading-tight md:text-3xl`, `space-y-*` com margem no filho, `outline` +
  `outline-1`…), do estado (`outline-2` sozinho: nada em repouso e o anel `auto`
  do navegador no foco por teclado), da fonte do navegador (`md:` em px) e as
  molduras de gatilho e de campo de `packages/ui` (`TRIGGER_FRAME`,
  `FIELD_FRAME`, `FILTER_FIELD_FRAME`, `MENU_TRIGGER_FRAME`, lidas da fonte)
  contra o componente da produção, que tirava o contorno das regras globais; o
  preflight de botões e campos, degradê sem `from-*` e os utilitários que o
  Tailwind 4 removeu (`ring-opacity-*`…);
- confere por ELEMENTO (achado 128) os elementos de foco de `packages/ui`
  (`FOCUS_ELEMENTS`: gatilhos e itens de menu, X do `Dialog` e do `Sheet`, caixa
  de seleção, abas, `CloseButton`, cartão de filtros), com o DOM do componente e
  as molduras lidas da fonte, contra o componente da produção (as regras globais
  por papel, `aria-label` e `aria-haspopup` entram), em repouso, no clique
  (`:focus`, com e sem `:focus-visible` pelo foco movido por código) e no
  teclado, com a modalidade de entrada no `<html>` (`data-input-modality`), no
  modo normal e nas cores forçadas; e a regra do foco: nenhum contorno em
  repouso e no clique em nenhum modo, o anel da marca no teclado e, nas cores
  forçadas, contorno visível no teclado;
- o tom da paleta lido pela variável do tema (`bg-[var(--color-gray-50)]`,
  `text-[var(--color-red-800)]`, com opacidade opcional) compara com a classe da
  paleta da produção (`bg-gray-50`, `text-red-800`): a produção não tinha a
  variável (`toProduction` de `support/tailwind-parity.mjs`, achado 141); as
  outras variáveis (`--brand`, `--layer-*`…) comparam o mecanismo, com os tokens
  do design-tokens antes do CSS da `main`;
- exceções só em `tailwind-parity/exceptions.json`, cada uma com motivo:
  utilitários e variantes próprios do projeto (moldura dos campos, anel de foco
  laranja, estado de erro por `aria-invalid`), `sr-only`, a especificidade menor
  de `group-*`/`peer-*` e, nos elementos de foco (`foco`, com os valores
  exatos), o anel da marca no teclado, o contorno do teclado nas cores forçadas
  (acessibilidade) e nenhum contorno no clique onde a produção desenhava.

O teste compara a semântica das classes, não as regras globais da produção com
`!important` que venciam classes (saíram nas ondas 4 e 5); as molduras de campo,
seletor e gatilho de menu são conferidas contra o componente da produção, e os
elementos de foco também nas cores forçadas. Nelas, o `outline-hidden` (como o
`outline-none` do Tailwind 3) grava um sólido transparente que o sistema pinta;
onde ele vale em repouso ou no clique, `forced-colors:outline-0` zera a largura
(`MENU_FOCUS_RING`, `FILTER_CARD`; na caixa de seleção, `HALO_FOCUS_OUTLINE`:
`forced-colors:focus:outline-0` e `forced-colors:focus-visible:outline-2`). Fora
dos elementos de foco, o `focus:outline-hidden` segue o `outline-none` do
Tailwind 3 (como na produção) e desenha no foco nas cores forçadas, também pelo
mouse: cartões das abas de categoria, item do `Select`, botões do `ImageUpload`
e outros (pendente).

Classe nova no código sem valor da produção na fixture faz o teste falhar.
Regenere a fixture (precisa do Tailwind 3.4.17 e dos plugins da `main` no
armazenamento do pnpm; `--pnpm <pasta>` aponta outro) e rode o teste de novo.
Sem esses pacotes no `node_modules/.pnpm` do repositório, instale-os fora dele
(pasta temporária, nunca no repositório) a partir do lockfile da `main`, com
`pnpm install --offline --frozen-lockfile --ignore-workspace` e o mesmo
`--store-dir`, e passe `--pnpm <pasta>/node_modules/.pnpm`. Nome solto no código
lido pelo Tailwind (variável `paused`, por exemplo) também vira utilitário e
entra na conta:

```bash
node tests/visual/support/tailwind-parity-fixture.mjs
pnpm exec vitest run --config tests/visual/vitest.config.ts tests/visual/tailwind-parity.test.ts
```

A semântica da produção vive no tema e nas camadas:
`packages/design-tokens/src/scales.css` (`shadow-sm`, `blur-sm`,
`drop-shadow-*`, `rounded-full`, altura de linha de `text-*`, `outline` e `ring`
sem largura, breakpoints `sm`…`2xl` em px) e
`packages/frontend/src/app/styles/utilities.web.css` (`hover:` sem
`(hover: hover)`, `transform` único de translate/scale/rotate,
`space-*`/`divide-y` a partir do segundo filho, `text-*` sem `--tw-leading`,
listas de `transition` e `container`), `outline.web.css` (`outline-<n>` só
largura: o estilo vem do utilitário de estilo do elemento ou, sem ele, do
`revert-layer`, que deixa o anel `auto` do navegador no foco por teclado), mais
o preflight em `base.web.css`.

## Consulta da assinatura do dono (onda 105)

subscription-owner.spec.ts monta /admin/assinatura no host web real com dados
sintéticos: seis estados, fatura, links seguros e recusa de dono nas larguras
390/1440, sem overflow ou escrita na API. A persona ADMIN da baseline anterior é
equipe sem propriedade: os dois GETs comerciais respondem 403 explícito. O
dashboard continua comparado com as capturas existentes, sem regravar a baseline
para incluir dados comerciais do dono. Screenshots da tela nova são evidência
local; não substituem testes RLS, aparelho ou provedor real.

A validação global Tailwind da onda 105 encontrou 12 classes anteriores de
logística/manutenção sem fixture (entrada 287 de known-issues.md). Esse teste
continua pendente; checker, fixture e exceções não foram relaxados.

## Aceite da interface em 2026-10-09

O usuário confirmou a fidelidade da interface atual. A referência passa a ser a
composição já conferida de 80 JSON/536 estados das páginas e dos catálogos no
build `R7kHAAzDS69RA5Yc0oQ1F`; não é uma nova rodada única nem indicação de que
o usuário inspecionou individualmente todos os estados. A referência e as
aprovações anteriores foram preservadas no scratchpad com hashes, e exceções
antigas redundantes saíram. A entrada 336 registra a decisão e os limites de
Dialog/open 390, Slow 3G e dispositivos. Novas mudanças continuam exigindo
comparação e aceite pertinentes.

O comparador recusa pastas e JSONs sem captura; `--write-baseline` valida toda a
entrada e recusa perder arquivos ou estados anteriores. Não use um foco parcial
para substituir a referência integral.
