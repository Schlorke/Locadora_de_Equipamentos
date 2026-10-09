# Gates com catraca (arquitetura, tokens e higiene)

> **Status**: Critical **Last updated**: 2026-09-30

---

## 1. Purpose

Impedir que a dívida de arquitetura e de tokens cresça enquanto a migração
avança. A dívida existente fica congelada por arquivo e regra; qualquer aumento,
arquivo novo com violação ou burla do registro reprova o gate.

## 2. Scope

**In scope**

- `pnpm arch` (`tools/arch-check.mjs` + `tools/arch-runtime.mjs`) e a catraca em
  `tools/arch-baseline.json`.
- `pnpm tokens` (`tools/token-check.mjs`) e a catraca em
  `tools/token-baseline.json`.
- `pnpm ratchet:guard` (`tools/ratchet-guard.mjs`): âncora das duas catracas no
  commit base.
- `pnpm check:tokens` (`tools/token-propagation-check.mjs`) com a lista de
  níveis ainda não provados.
- `pnpm check:test-names` (`tools/test-colocation-check.mjs`): teste colocado
  precisa aninhar sob o arquivo que testa (onda 3).
- `pnpm hygiene` (`tools/hygiene-check.mjs`, `knip.jsonc`): arquivo, export,
  tipo e dependência sem uso (inclusive o que só um teste mantém vivo e o export
  sem consumidor do ponto de entrada dos pacotes), variante `.native` órfã, CSS
  sem importador, tag JSDoc que esconde export e saída de ferramenta fora do
  `.gitignore` ou versionada, com a linha de base `tools/hygiene-baseline.json`
  (lotes limpeza-config e limpeza-reparo). Desde a onda 135 (A0, E24), também
  `workspace-unlisted`: pacote que o código de produção de um workspace
  (`pnpm-workspace.yaml`) importa sem declarar no `package.json` dele; o knip
  aceitava a dependência declarada só na raiz, e o workspace quebraria quando a
  raiz saísse ou fosse podada. Teste, story e config/setup do ferramental de
  teste ficam de fora (o ferramental de teste mora na raiz, por desenho), e o
  par que o knip já reporta como `unlisted` não se repete.
- `pnpm lint` (`eslint.config.js`): import, variável e função privada sem uso
  são erro (o `--quiet` do script esconderia um aviso).

**Out of scope**

- Corrigir a dívida congelada (trabalho dos lotes de migração).
- Regras absolutas antigas do arch-check e do token-check, que continuam
  reprovando sem baseline fora da raiz legada.

## 3. Entry Points

- `tools/arch-check.mjs`, `tools/arch-runtime.mjs`, `arch.config.json`
  (`universalSourceRoots`, `ratchetBaseline`, `legacyRoots`).
- `tools/token-check.mjs` (`legacyScope`: `app`, `lib`, `middlewares`,
  `schemas`, `stores`, `types`, `proxy.ts`, `instrumentation.ts`).
- `tools/ratchet-guard.mjs`, `tools/ratchet-transfers.json`: renomeações
  (`--rename`), transferências de configuração e aprovações
  `{ approve, entry, reason }` de estreitamento decidido pelo produto (por
  exemplo `package.exports` com `"<pacote>#<subcaminho>"`, como os
  `./palette.css` e `./scales.css` do design-tokens); o `$comment` do arquivo
  descreve as três formas.
- `tools/token-propagation-expectations.json`.
- `knip.jsonc` (entradas reais por workspace e exceções comentadas),
  `tools/hygiene-check.mjs`, `tools/hygiene-knip-reporter.mjs` e
  `tools/hygiene-baseline.json` (cada item com `reason`).
- CI: job `architecture` em `.github/workflows/ci.yml`.

## 4. Core Flow

1. `pnpm arch` e `pnpm tokens` comparam a árvore com a baseline da própria
   árvore: contagem acima da baseline, arquivo novo ou regra nova reprovam
   (`[ratchet: N > baseline M]` / `RATCHET new file`). Redução passa com aviso.
2. `pnpm ratchet:guard` lê as baselines no merge-base (`--base`,
   `RATCHET_BASE_REF`, `origin/main` ou `HEAD~1`) com `git show` e reprova
   contagem que sobe, par arquivo/regra novo, baseline ou regra que some e
   baseline inválida. No CI, a base é `origin/<base_ref>` no PR e o commit
   anterior no push (`fetch-depth: 0`). Em repositório novo com um único commit,
   sem SHA anterior do evento e sem `HEAD^`, o snapshot inicial revisado semeia
   a baseline usando `HEAD`; assim que existe pai, o CI compara com `HEAD^`.
   - Desde a onda 4 (entrada 192 de `docs/issues/known-issues.md`), a baseline
     da base é localizada pelo `arch.config.json` da base (`git show`), com
     fallback para o caminho da árvore e para o local histórico: apontar
     `ratchetBaseline` para outro arquivo não troca o termo de comparação.
   - Quando a configuração muda, o guard conta o código da árvore com a
     configuração da base e com a da árvore; um arquivo que a base conta mais
     reprova. A configuração pode ampliar o que é contado, nunca estreitar. A
     comparação é pelo total por arquivo, então reclassificar entre regras não
     reprova.
3. `pnpm hygiene` roda o knip (plugins de next, expo, vitest, playwright,
   storybook, eslint, prisma, postcss e tailwind, mais as entradas do
   `knip.jsonc`) e cruza os achados com `tools/hygiene-baseline.json`: achado
   sem item reprova, item que não acontece mais reprova (a linha de base só
   encolhe) e dica do knip de exceção que sobrou também reprova. O
   `ratchet:guard` barra item novo na linha de base (e nome novo num item) e
   exceção nova no `knip.jsonc` (`entry`, `ignore*`), escopo a menos (valor de
   `project` que sai, negação `"!pasta/**"` que entra em `project`, workspace)
   ou regra mudada, salvo aprovação com motivo em `tools/ratchet-transfers.json`
   (`hygiene.baseline` / `hygiene.knip`).
   - Entradas do `knip.jsonc` são arquivo por arquivo: glob de entrada só para
     suíte de teste, story, variante `.native` e rota do expo-router (um glob
     como `tools/**/*.mjs` faria todo script novo da pasta contar como usado). O
     `project` de cada host e pacote cobre a pasta inteira, CSS inclusive.
   - Nos pacotes, `includeEntryExports`: o export do ponto de entrada (`exports`
     do `package.json`) sem consumidor reprova. Toda `.native` é entrada (o knip
     não resolve o sufixo do Metro); o export dela sai do relatório quando a
     irmã exporta o mesmo nome (o uso é o da irmã) e fica quando só a `.native`
     o tem.
   - Passe sem testes: o knip roda de novo sem arquivos e pastas de teste nas
     entradas e no `project` e com vitest e playwright desligados; o arquivo
     (`test-only-file`) e o export (`test-only-export`) que só este passe acha
     existem só por causa de um teste.
   - CSS sem importador (`css-orphan`) nos workspaces em que o knip não lê CSS
     (dica `project-extension-unregistered`); tag JSDoc que o knip sempre
     esconde (`export-tag`: public, beta, alias).
   - Saídas de ferramenta (`TOOL_OUTPUTS`): relatórios do Playwright, cobertura,
     capturas visuais, builds e caches (`.next`, `.expo`, `dist-export`,
     `.turbo`, `*.tsbuildinfo`...) e logs (`*.log`, `eslint-output.txt`,
     `build-output.txt`, `test-output.txt`), cada uma com os caminhos que o
     `.gitignore` precisa ignorar e a regra que acha o arquivo versionado em
     qualquer nível.
   - Item de arquivo da linha de base com glob lista em `names` cada arquivo que
     aceita: um arquivo morto novo na pasta reprova.
4. `pnpm check:tokens` sai 0 quando o estado medido bate com
   `tools/token-propagation-expectations.json`; falha em regressão de nível
   provado e em nível listado que passou a ser provado sem sair da lista.
   Verificações de integridade nunca podem ser listadas.

## 5. Components and Files

Regras com catraca no arch-check:

| Regra                | O que conta                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `UNIVERSAL-DOM-JSX`  | JSX de elemento DOM em arquivo universal (sem sufixo) de `packages/frontend/src`               |
| `UNIVERSAL-WEB-LIB`  | Import de runtime de lib web-only em arquivo universal                                         |
| `WORKSPACE-ESCAPE`   | Workspace que sai de si sem passar por entrypoint declarado em `exports`                       |
| `LEGACY-DEEP-IMPORT` | Raiz legada importando internos de um pacote sem entrypoint declarado                          |
| `LEGACY-DOM-JSX`     | JSX de DOM na raiz legada                                                                      |
| `LEGACY-WEB-LIB`     | Biblioteca de UI de produto na raiz legada (`next`, `react-dom` e `next-auth/react` liberados) |

Regras com catraca no token-check: `tailwind-palette-class`, `arbitrary-color`,
`arbitrary-dimension`, `hsl-triple` e `z-index-literal`; na raiz legada toda
regra vira catraca, inclusive `color-literal` e `number-literal`.

Regra de tolerância zero (`ZERO_TOLERANCE_RULES`, onda 4): `css-important`
reprova qualquer ocorrência em todo escopo (produto, raiz legada e fonte
canônica), sem baseline e sem `allow`. `readBaseline` recusa uma baseline que a
conte; `tools/token-baseline.json` a mantém em `rules` (`BASELINE_RULES`) com
cota zero para o `ratchet-guard` acusar se ela sair da lista. A saída do
`pnpm tokens` tem a linha
`zero tolerance (every scope, no baseline): css-important N`.

`css-important` conta `!important` e `! important` em CSS/SCSS/Sass/Less, em
strings e templates de código (inline, CSS-in-JS, `<style>`,
`setProperty(..., "important")`, `@import "tailwindcss" important`) e o
modificador `!` do Tailwind (prefixo, sufixo, com variantes, em `@apply`) em
contexto de classe. Desde a onda 5 não há exceção nenhuma (saiu a do bloco
`@media (prefers-reduced-motion: reduce)`), e a regra também lê o config JS do
Tailwind (o do `@config` de cada folha lida e o `tailwind.config.*` da raiz) e
os plugins locais (`@plugin` e `require`/`import` relativos): reprova
`important: true` ou um seletor e `!important` em `addUtilities`, `addBase` e
afins (fixture `tests/unit/__fixtures__/tokens/tailwind-config/`).
`token-check-allow` e entradas `allow` não isentam. O `stylelint` do
`pnpm lint:css` reprova qualquer `!important` em `.css`. Detalhes e histórico:
entradas 177, 194 e 202 de `docs/issues/known-issues.md`.

Regra absoluta `jsx-text-escape` (onda 5, escopo do produto): escape `\u00XX` em
texto JSX ou em atributo, que aparece literal na tela; a exceção é o atributo
`pattern` (fixture `tests/unit/__fixtures__/tokens/escapes/`, entrada 203).

Nomes de teste (`check:test-names`, não é catraca): lê `explorer.fileNesting` de
`.vscode/settings.json` e aplica o mesmo algoritmo de aninhamento do VS Code
(diferenciando maiúsculas, como no Linux do CI). Teste órfão reprova; a exceção
fica em `tools/test-colocation-allowlist.json` com motivo de 8 ou mais
caracteres, e entrada de arquivo que sumiu ou que voltou a ter assunto também
reprova (a lista só encolhe). Ficam de fora `tests/` da raiz, `__fixtures__`,
pastas com ponto, `node_modules`, saídas de build e links.

## 6. Data and State

Contagens (baseline no commit `0cff7b65` → onda 2 → onda 3 → árvore da onda 4 em
2026-09-26, medida com `pnpm arch`, `pnpm tokens` e `pnpm ratchet:guard`):

| Catraca                   | Base (`0cff7b65`)   | Onda 2     | Onda 3     | Onda 4     |
| ------------------------- | ------------------- | ---------- | ---------- | ---------- |
| Arquitetura, total        | 1062 em 76 arquivos | 1109 em 92 | 1108 em 91 | 1108 em 91 |
| `UNIVERSAL-DOM-JSX`       | 990                 | 990        | 990        | 990        |
| `UNIVERSAL-WEB-LIB`       | 69                  | 70         | 69         | 69         |
| `WORKSPACE-ESCAPE`        | 3                   | 0          | 0          | 0          |
| `LEGACY-DEEP-IMPORT`      | —                   | 9          | 9          | 9          |
| `LEGACY-DOM-JSX`          | —                   | 34         | 34         | 34         |
| `LEGACY-WEB-LIB`          | —                   | 6          | 6          | 6          |
| `tailwind-palette-class`  | 6432                | 6466       | 6454       | 6409 (*)   |
| `arbitrary-color`         | 18                  | 20         | 20         | 20         |
| `arbitrary-dimension`     | 595                 | 599        | 597        | 596        |
| `hsl-triple`              | 64                  | 64         | 64         | 0          |
| `z-index-literal`         | 366                 | 367        | 365        | 359        |
| `css-important`           | —                   | —          | 22         | 0 (zero)   |
| `color-literal` (legado)  | —                   | 193        | 193        | 193        |
| `number-literal` (legado) | —                   | 8          | 8          | 8          |

- As entradas novas vieram só da cobertura nova (raiz legada, formas do Tailwind
  4.3.3, listas web-only) medida no código da base com `--adopt-coverage`;
  nenhuma regressão foi absorvida. O `UNIVERSAL-WEB-LIB` +1 da onda 2 era
  `shared/lib/sanitize.ts` (isomorphic-dompurify); saiu na onda 3 com as
  variantes `.web`/`.native` (entrada 184). `WORKSPACE-ESCAPE` caiu para 0
  quando as páginas do host web deixaram de importar `lib/prisma`.
- `css-important` entrou com `--adopt-coverage` (415 medidas no código da base)
  e foi travada em 22 depois do lote "CSS limpo"; na onda 4 chegou a 0 e virou
  regra de tolerância zero.
- Onda 4: `hsl-triple` e `z-index-literal` caíram com os tokens levados de
  `globals.web.css` para `packages/design-tokens`. (*) A baseline de
  `tailwind-palette-class` é 6409, mas a árvore tem 6414: as 5 a mais estão no
  arquivo novo `apps/clients/web/src/app/(auth)/login/page.tsx` (fallback do
  `Suspense`), e o `pnpm tokens` sai 1 até a correção no código. Antes do commit
  `4b02f52f` o fallback passou a ser o `LoginPageFallback` da página
  compartilhada, sem classes de paleta.
- Onda 5 (sem contagem consolidada): `tools/token-baseline.json` baixou na
  árvore da onda 5 (por exemplo, `tailwind-palette-class` de 6404 para 6286); o
  lote A2 removeu 161 classes sem efeito. Os arquivos do lote D2
  (`RecuperarSenhaPage.web.tsx` e `ResetPasswordPage.web.tsx`) baixaram mais 6
  contagens de paleta, dimensão arbitrária e `z-index`, e o lote não rodou o
  `node tools/token-check.mjs --update-baseline`; conferir na rodada completa
  antes do commit.
- Cores literais de e-mail e PDF na raiz legada (`lib/email-templates.ts`,
  `lib/pdf/*`) ficam congeladas pela catraca (decisão pendente: aceitar ou
  registrar `token-check-allow:` com motivo).

## 7. Constraints and Edge Cases

- Mover ou renomear arquivo com dívida conta como "arquivo novo". Transferir:
  1. `node tools/ratchet-guard.mjs --rename <caminho antigo> <caminho novo> --reason "<motivo com 8+ caracteres>"`;
  2. a origem precisa ter saído do disco e existir na baseline da base; a
     entrada muda de lugar em todas as baselines que a têm e a transferência
     fica em `tools/ratchet-transfers.json` (o total nunca aumenta). Desde a
     onda 4, o `ratchet-guard` só aceita a transferência com `counts`, origem
     fora da árvore, destino que não existia na base (`git cat-file -e`) e
     renomeação detectada pelo git (`git diff --no-index --find-renames` só no
     par); a cota movida é `min(base, counts)`, e o `--adopt-coverage` também só
     usa transferências aceitas. Transferência cuja origem não tem entrada na
     base aparece como `stale` e é ignorada;
  3. rodar `pnpm arch`, `pnpm tokens` e `pnpm ratchet:guard`.
- Regra nova, padrão mais amplo ou escopo novo:
  `node tools/ratchet-guard.mjs --adopt-coverage` grava só o que as ferramentas
  atuais medem no código da base, limitado pela contagem atual.
- `--update-baseline` só trava reduções; `--init-baseline` só cria o arquivo
  quando ele não existe. Nunca editar as baselines à mão nem apagar e recriar.
- A extração da base usa `git ls-tree` + `git cat-file` num diretório
  temporário, sem links para o repositório (ver entrada 171 de
  `docs/issues/known-issues.md`).
- Isenções do token-check: referências a token (`bg-primary`, `w-[var(--x)]`,
  `z-[var(--layer-*)]`), definição de `--layer-*` e o comentário
  `token-check-allow: <motivo>`.

## 8. Error Handling

- `RATCHET-BASELINE`: baseline inválida (total que não bate ou regra que não é
  de catraca).
- `ratchet guard failed: a baseline grew beyond the base`: corrigir o código ou
  registrar a transferência.

## 9. Performance and Accessibility

- Não se aplica (ferramentas de CI).

## 10. Tests and Validation

Na revisão de 2026-10-09, a classificação dos componentes web foi corrigida com
variantes `.web` e contratos puros separados, preservando a interface.
`pnpm arch` mediu zero `UNIVERSAL-DOM-JSX`, `UNIVERSAL-WEB-LIB` e
`WORKSPACE-ESCAPE` no frontend. A catraca foi reduzida para 43 ocorrências em 16
arquivos, todas na raiz legada: seis `LEGACY-DEEP-IMPORT`, 31 `LEGACY-DOM-JSX` e
seis `LEGACY-WEB-LIB`. Sua retirada continua na etapa F. As 53 transferências de
baseline de tokens apenas mudam o caminho do arquivo para a variante web
correspondente; não aumentam a tolerância. Os três níveis de propagação ainda
listados como não provados por `check:tokens` continuam limites explícitos, não
evidência de execução web ou mobile.

### Execução local completa

Confira o exit de cada etapa e faça o comando externo falhar quando alguma etapa
falhar. Um `echo DONE` ou uma leitura de log no final não pode substituir o
resultado das suítes. A execução herdada de 30/09 tinha exit externo 0 com cinco
suítes reprovadas (known-issues 230).

Use banco local explicitamente descartável com nome `test`, `test_*` ou
`*_test`; mantenha `TEST_DATABASE_DISPOSABLE=true`. No Windows, os testes do
hook exigem `sh` do Git Bash no PATH, além do Node de `.node-version`. Controle
a concorrência: `test:unit` já inclui os arquivos de `test:gates`, portanto não
rode ambos simultaneamente como duplicatas. O handoff usou `--maxWorkers=2` nas
suítes amplas, sem ampliar timeout ou afrouxar asserções. Para HTTP,
`tests/global-setup.ts` aceita `TEST_PORT`/`TEST_BASE_URL` explícitos e cria e
encerra o próprio servidor; uma porta ocupada por outra sessão não deve ser
reutilizada.

### Cobertura dos gates

- `pnpm test:gates` (`tests/unit/architecture-runtime.test.ts`,
  `tests/unit/token-check.test.ts`, `tests/unit/test-colocation-check.test.ts`
  e, desde a onda 4, `tests/unit/ratchet-guard.test.ts`): 90 testes na árvore da
  onda 4 (eram 81 na onda 3 e 60 na onda 2). Desde o lote higiene-final (onda 9)
  também `eslint-runtime-rewrite`, `stylelint-css-structure`, `ci-workflow` e
  `pre-commit-hook`; `tests/unit/ci-workflow.test.ts` deriva os gates das
  ferramentas que o CI roda (scripts do workflow, plugins do ESLint e do
  Stylelint e o que eles importam de `tools/`) e reprova teste de gate fora do
  `test:gates` ou arquivo listado que não existe. Desde o lote fechamento-final
  também `destructive-commands` (script que mata todo Node ou apaga
  `node_modules` de forma recursiva) e `retired-artifacts` (artefato aposentado
  citado como vivo em docs e comentários; entrada 229 dos known-issues). O
  `ratchet-guard.test.ts` monta repositórios git descartáveis: redirecionamento
  da baseline, baseline configurada ausente, estreitamento com dívida nova e
  existente, ampliação, transferência sem renomeação e cota limitada.
- Na árvore da onda 4 em 2026-09-26: `pnpm arch`, `pnpm check:tokens`,
  `pnpm check:test-names` (406 testes colocados, 4 órfãos na allowlist) e
  `RATCHET_BASE_REF=be859915 pnpm ratchet:guard` saem 0; `pnpm tokens` sai 1
  pelo arquivo novo citado na seção 6.
- Na árvore da onda 3 em 2026-09-26: `pnpm arch`, `pnpm tokens`,
  `pnpm check:tokens` (três níveis listados como não provados: resolução de
  estilo web, render web e export mobile), `pnpm check:test-names` (386 testes
  colocados, 4 órfãos na allowlist) e `pnpm ratchet:guard` saem 0. A
  transferência das três páginas de auth movidas na onda 2 foi registrada antes
  do commit `da19f601`.

- `tests/unit/hygiene-check.test.ts` roda o knip de verdade num repositório
  descartável: um arquivo morto sintético reprova, o item com motivo o aceita e
  o item velho reprova; também cobre export e dependência sem uso, saída de
  ferramenta versionada, variante `.native` órfã e o `workspace-unlisted` (o
  pacote que só a raiz declara reprova; declarado no workspace, passa).
  `tests/unit/ratchet-guard.hygiene.test.ts` cobre a âncora na base (item novo,
  exceção nova, escopo a menos, aprovação).

## 11. Related Docs

- `docs/architecture/adr-runtime-boundaries.md`
- `docs/architecture/modernization.md`
- `docs/issues/known-issues.md` (entradas 160 e 171)
- `docs/features/design-system.md`

## 12. Change Log

- 2026-09-26: catracas na raiz legada, âncora no commit base
  (`tools/ratchet-guard.mjs`), formas do Tailwind 4.3.3, listas web-only
  completas e `check:tokens` com lista de expectativas, no commit `da19f601`. As
  catracas originais entraram no commit `0cff7b65`.
- 2026-09-26 (onda 3, commit `be859915`): regra `css-important` e gate
  `check:test-names` (passo no job `architecture` do CI).
- 2026-09-26 (onda 4, commit `4b02f52f`): baseline da base pela configuração da
  base, estreitamento reprovado, transferência só com prova de renomeação,
  `css-important` de tolerância zero e `tests/unit/ratchet-guard.test.ts` em
  `test:gates`.
- 2026-09-29 (onda 5, sem commit): `css-important` sem exceção de movimento
  reduzido e lendo o config JS e os plugins locais do Tailwind; regra absoluta
  `jsx-text-escape`.
- 2026-09-30 (lote limpeza-config, sem commit): gate `pnpm hygiene` (knip 6.38)
  no job `architecture` do CI, linha de base de higiene ancorada pelo
  `ratchet:guard` e testes em `test:gates`.
- 2026-09-30 (lote higiene-final, sem commit): aprovações `package.exports` dos
  CSS do design-tokens, `test:gates` completo e conferido por teste, e
  `.husky/pre-commit` testado (entrada 227 de `docs/issues/known-issues.md`).
- 2026-10-02 (extração de perfil, corte 25, sem commit): registro de
  `package.exports` para contracts/customer-profile. Publica só o schema Zod
  estrito movido do adapter legado, consumido pelos dois hosts; contrato puro,
  sem wildcard, import de servidor ou achado novo tolerado. Baselines,
  verificadores e escopos de testes permanecem intactos neste corte.

- 2026-10-08 (onda 135, lote A, A0): achado `workspace-unlisted` no
  `pnpm hygiene`; `packages/frontend` declara `three` e `@react-three/*`,
  `packages/backend` declara `zod` e `apps/clients/web` declara o
  `@vercel/analytics` e o `@vercel/speed-insights`. `three` e `@react-three/*`
  ficam também na raiz pelo DC-26 (entrada 226), com item "decidir" aprovado na
  linha de base. A1 (E9): `types/` deixa de ser raiz legada inteira
  (`types/next-auth.d.ts` em `nonRuntimeRoots`, os dois `.d.ts` da raiz por
  caminho), com as aprovações `arch.legacyRoots`, `arch.nonRuntimeRoots` e
  `tokens.legacyScope`.

---

_Template version: 2026-01-20_

- 2026-10-02 (corte 26, sem commit): ponto explícito
  contracts/customer-enrollment no registro de package.exports. Publica somente
  o schema estrito de consentimento que saiu do adapter legado e atende os dois
  hosts. Não há wildcard nem implementação de servidor nesse ponto, alteração de
  baseline ou redução de teste. Inventário acrescenta a composição pública do
  serviço com prova de delegação; ambas as rotas de vínculo precisam também
  verificar a sessão antes da única criação, além do guard CSRF.

- 2026-10-02 (corte 27, sem commit): novo ponto contracts/drivers, com apenas o
  schema Zod já existente no adapter legado. Registro explícito de
  package.exports na extração autorizada; nenhum wildcard, guard removido ou
  alteração de baseline. Os dois POSTs exigem ADMIN da locadora atual e o
  principal central com CSRF; o inventário estrutural permanece sem novas
  exceções. Zod 4.6.5, já usado na raiz, agora é dependência direta declarada do
  serviço para preservar o reconhecimento do erro de validação genuíno.

- 2026-10-02 (corte 28, sem commit): ponto explícito contracts/categories no
  registro de package.exports. Publica apenas o schema estrito existente de
  criação, consumido pelos dois adapters na extração autorizada. Nenhum
  wildcard, implementação de servidor, guarda removida ou mudança de baseline.
  EQUIPMENTS/WRITE e principal central com CSRF continuam visíveis ao inventário
  de autorização, sem ampliar suas exceções.

- 2026-10-02 (corte 30, sem commit): ponto explícito contracts/equipment-units
  no registro de package.exports. Publica somente o schema Zod de criação
  existente no adapter legado, consumido pelos dois hosts. Nenhum wildcard,
  regra de servidor, alteração de baseline ou exceção nova do inventário. POST
  conserva EQUIPMENTS/WRITE e principal central com CSRF antes do corpo.

- 2026-10-02 (corte 31, sem commit): schema de atualização de unidades físicas
  compartilhado no mesmo entrypoint contracts/equipment-units, sem novo export
  de pacote ou regra de servidor. Os dois PATCHs/DELETEs exigem ações distintas
  e o principal central com CSRF. Nenhuma baseline, gramática ou exceção do
  inventário mudou.
