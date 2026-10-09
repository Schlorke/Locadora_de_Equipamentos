# 🤖 AGENTS.md - Guia de Comportamento para a IA no Projeto GB-Locações

> **ARQUIVO CRÍTICO**: Este arquivo define as regras de comportamento, o fluxo
> de trabalho obrigatório e os ponteiros para a documentação essencial. A
> documentação detalhada de funcionalidades, troubleshooting e contexto de
> projeto reside na pasta `docs/`.

---

## 1. 🚨 A Regra Mais Importante: O Processo é Inegociável

**NÃO EXISTE EXCEÇÃO**: Qualquer alteração, não importa o quão pequena (1 linha
de código, ajuste de texto, bug "simples"), DEVE seguir o fluxo de trabalho
completo abaixo. Velocidade não justifica pular etapas.

> **Lição Aprendida (Dez 2025)**: Uma IA pulou a documentação porque a tarefa
> "era simples" (corrigir loading de 2 botões). Resultado: retrabalho e
> frustração do usuário.

---

## 2. 🧠 Fluxo de Trabalho Obrigatório

Este é o processo que você DEVE seguir para toda e qualquer tarefa.

### ANTES de Escrever Qualquer Código

```
1. ? Ler docs/ai/boot.md e docs/ai/context-map.md (OBRIGATÓRIO)
   → Entender o fluxo mínimo e onde buscar contexto.

2. ? Ler docs/issues/known-issues.index.md e pesquisar em docs/issues/known-issues.md (OBRIGATÓRIO)
   → Use `rg -n "palavra" docs/issues/known-issues.md` e abra apenas seções relevantes.

3. ? Ler docs/features/[componente-ou-pagina].md (OBRIGATÓRIO)
   → Se não existir, PERGUNTE ao usuário sobre o comportamento esperado e crie usando docs/features/_template.md.

4. ? Verificar componentes existentes em packages/ui/src (design system) e packages/frontend/src (fatias FSD)
   → Consulte packages/ui/src/catalog.ts e docs/COMPONENT_INVENTORY.md; não crie algo novo se já existe um similar.
```

### DEPOIS de Escrever o Código

```
1. ? Documentar bug/solução em docs/issues/known-issues.md (se aplicável)
   → Incluir: causa raiz, solução, arquivos modificados, como validar.
   → Atualizar docs/issues/known-issues.index.md quando o tema for recorrente.

2. ? Criar/atualizar docs/features/[componente-ou-pagina].md (se aplicável)
   → Seguir docs/features/_template.md e atualizar docs/features/INDEX.md quando for crítico.

3. ? Atualizar docs/ai/ quando houver mudança de processo ou navegação.

4. ? Atualizar CHANGELOG.md com a data REAL do commit
   → Use `git log --pretty=format:"%h %ad %s" --date=short` para verificar.

5. ? Teste colocado leva o nome do arquivo testado
   → <assunto>.test.ts(x) ou <assunto>.<aspecto>.test.ts(x), com .web/.native logo antes de .test.
   → `pnpm check:test-names` bloqueia órfãos; exceção só em tools/test-colocation-allowlist.json, com motivo.
```

---

## 3. 🛡️ Protocolo Anti-Alucinação

Estas são heurísticas de comportamento para evitar erros comuns.

### Regras de Ouro

1.  **A Fonte da Verdade é a Documentação**: Se você não tem certeza sobre algo,
    a resposta está na pasta `docs/`. Não assuma, verifique.
2.  **Faça APENAS o que o Usuário Pediu**: Não "melhore" ou "otimize" nada além
    do escopo da solicitação.
3.  **Não Modifique a Identidade Visual**: Nunca altere estilos, cores ou layout
    sem uma solicitação explícita.
4.  **Siga os Padrões Existentes**: O projeto tem padrões de código, arquitetura
    e design system. Siga-os.
5.  **Datas Reais**: Nunca invente datas para o `CHANGELOG.md`. Use `git log`.
6.  **Nunca Exponha Credenciais**: Em documentação, SEMPRE use placeholders
    genéricos. Consulte `docs/internal/documentation-security-guidelines.md`
    antes de criar/editar docs.
7.  **Nunca Ligue nem Apague o Repositório por Links**: nunca crie junção NTFS
    ou symlink para dentro do repositório (inclusive `node_modules`) e nunca
    rode `rm -rf`, `rmdir /s` ou `Remove-Item -Recurse` em pasta que possa
    conter links. Cópias só no scratchpad, sem `node_modules` ligados (incidente
    de 2026-09-26, entrada 171 de `docs/issues/known-issues.md`).
8.  **Não Deixe Sobras**: arquivo temporário (log, captura, cópia, script de
    sonda) só fora do repositório, no scratchpad ou no `%TEMP%`; servidor
    (`next dev`/`start`, Storybook, Expo) e navegador que você iniciou são
    derrubados antes de terminar, matando só os seus PIDs; pasta criada por
    ferramenta (`.playwright-mcp`, `test-results`, `playwright-report`,
    `coverage`, `storybook-static`) sai do repositório antes de terminar.
    `pnpm hygiene` reprova saída de ferramenta versionada ou fora do
    `.gitignore`, e arquivo, export ou dependência sem uso.

### Erros Críticos Documentados (Nunca Repetir)

| Erro                               | O que aconteceu                                                                                                  | Lição                                                                                                                       |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **Modificar Estilos Sem Pedido**   | Usuário pediu para corrigir lógica do RESET; IA também alterou estilos dos botões.                               | Corrija APENAS a funcionalidade. Estilos só se o usuário pedir.                                                             |
| **Assumir Comportamento do RESET** | Usuário disse "RESET não deve fazer nada para os botões de status"; IA adicionou `setStatusFilter(\'PENDING\')`. | "Não deve fazer nada" significa NADA. Não assuma.                                                                           |
| **Expor Credenciais em Docs**      | Chaves de API reais foram expostas em arquivos de documentação versionados no Git (Dez 2025).                    | NUNCA exponha credenciais reais. Use placeholders genéricos. Consulte `docs/internal/documentation-security-guidelines.md`. |

---

## 4. 📁 Estrutura de Documentação

A documentação do projeto é organizada da seguinte forma. **Consulte sempre a
pasta `docs/` antes de implementar.**

```
📁 docs/
├── 📄 README.md                  # Índice geral
├── 📄 ai/                        # Contexto rapido para IA
├── 📁 getting-started/           # Setup, desenvolvimento, deploy
├── 📁 architecture/              # Arquitetura técnica e stack
├── 📁 features/                  # Documentação de funcionalidades (CONSULTAR SEMPRE)
├── 📁 guides/                    # Guias específicos (Storybook, acessibilidade, etc.)
├── 📁 references/                # Referências técnicas e dependências
├── 📁 issues/                    # Problemas conhecidos e soluções (CONSULTAR SEMPRE)
└── 📁 internal/                  # Documentação interna e dados da empresa
```

---

## 5. 🔗 Ponteiros Críticos: Sua Base de Conhecimento

Use esta tabela como seu guia de referência rápida. A resposta para a maioria
das suas perguntas está nestes documentos.

**Produto**: plataforma SaaS por assinatura. Locadoras assinam a plataforma; a
receita é só a mensalidade; os pagamentos dos clientes vão para a locadora
(Asaas com uma subconta por locadora); painel em `app.<raiz>` e vitrine em
`{slug}.<raiz>`. As decisões estão nas duas ADRs da tabela abaixo.

| Situação                        | Documento de Referência                              | Propósito                                                                                     |
| :------------------------------ | :--------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **Produto SaaS por assinatura** | `docs/architecture/adr-saas-subscription.md`         | Assinatura, planos, onboarding, recebimentos, backoffice e lotes S0–S17.                      |
| **Locadora por host**           | `docs/architecture/adr-tenant-hosts.md`              | Subdomínio por locadora, painel no `app.`, identidade multi-host e lotes 0–12.                |
| **Contexto IA**                 | `docs/ai/boot.md`                                    | Fluxo minimo e ordem de leitura.                                                              |
| **Mapa de Contexto**            | `docs/ai/context-map.md`                             | Escolha rapida de docs por tarefa.                                                            |
| **Known Issues (index)**        | `docs/issues/known-issues.index.md`                  | Busca rapida sem ler o arquivo inteiro.                                                       |
| **Indice de Features**          | `docs/features/INDEX.md`                             | Localizar doc de funcionalidade com rapidez.                                                  |
| **Qualquer bugfix**             | `docs/issues/known-issues.md`                        | Verificar se o bug já foi resolvido.                                                          |
| **Modificar componente**        | `docs/features/[componente].md`                      | Entender a lógica e regras do componente.                                                     |
| **Usar Design System**          | `docs/features/design-system.md`                     | Cores, tipografia, componentes base.                                                          |
| **Sistema de Orçamentos**       | `docs/features/quote-system.md`                      | Regras de negócio críticas.                                                                   |
| **Sistema Admin**               | `docs/features/admin-system.md`                      | Padrões para a área administrativa.                                                           |
| **Dialogs e Modais**            | `docs/features/dialog-lab.md`                        | Padrão de implementação de dialogs.                                                           |
| **Arquitetura Geral**           | `docs/architecture/overview.md`                      | Stack e estrutura do projeto.                                                                 |
| **Setup e Deploy**              | `docs/getting-started/`                              | Instalação e implantação.                                                                     |
| **Compatibilidade**             | `docs/references/dependencies.md`                    | Versões e problemas de dependências.                                                          |
| **Dados da Empresa**            | `docs/internal/company/README.md`                    | CNPJ, endereço, contatos oficiais.                                                            |
| **Troubleshooting Rápido**      | `docs/guides/troubleshooting-quick-reference.md`     | Soluções rápidas para problemas comuns.                                                       |
| **Segurança em Docs**           | `docs/internal/documentation-security-guidelines.md` | Diretrizes para não expor credenciais em documentação.                                        |
| **Carrossel 3D**                | `docs/features/equipment-3d-carousel.md`             | **CRÍTICO**: Lógica de sincronização com ScrollReveal.                                        |
| **Performance React / Next.js** | `docs/guides/performance-optimization.md`            | Otimizações de performance e bundle. Também: `docs/guides/javascript-bundle-optimization.md`. |

---

## 5.1. 🚨 Componentes Críticos - Lógica que DEVE ser Preservada

Alguns componentes possuem lógicas críticas que **NUNCA devem ser alteradas**
sem consultar a documentação específica. Estes componentes foram projetados com
sincronização explícita e dependências complexas.

### Equipment 3D Carousel

**Arquivo**:
`packages/frontend/src/widgets/hero/ui/Equipment3DCarousel.web.tsx` +
`packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx` **Documentação**:
`docs/features/equipment-3d-carousel.md` **Status**: 🔴 **CRÍTICO - NÃO ALTERAR
SEM LER DOCUMENTAÇÃO**

**Lógica Crítica**:

- O primeiro modelo 3D (índice 0) **NUNCA** deve executar animação de zoom
  durante o carregamento inicial ou refresh da página
- Sincronização explícita através do evento `scrollRevealReady`
- Modelos seguintes executam zoom normalmente com animação suave

**Regras Obrigatórias (NUNCA VIOLAR)**:

1. ✅ **SEMPRE** consulte `docs/features/equipment-3d-carousel.md` antes de
   modificar
2. ✅ **PRESERVE** as props `delayBoundsFit` e `isRevealComplete`
3. ✅ **MANTENHA** a lógica `hasPassedFirstModel = currentIndex > 0`
4. ✅ **GARANTA** que o primeiro modelo não exibe zoom visível
5. ✅ **PRESERVE** a prop `maxDuration={0}` no componente `<Bounds>` para o
   primeiro modelo
6. ✅ **MANTENHA** a prop `disableAutoFit` que controla `maxDuration`
7. ❌ **NUNCA** remova a sincronização explícita
8. ❌ **NUNCA** faça o primeiro modelo executar `Bounds.fit()` imediatamente
9. ❌ **NUNCA** remova ou altere `maxDuration={0}` para o primeiro modelo
10. ❌ **NUNCA** remova a prop `disableAutoFit` do `SceneContent`

**Solução Técnica Crítica**:

A solução depende de **DUAS partes** funcionando juntas:

1. **Timing do evento `scrollRevealReady`** (1.6s para primeira visita)
2. **Prop `maxDuration={0}` no Bounds** para o primeiro modelo ← **CRÍTICO**

```typescript
// packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx - SceneContent
const boundsMaxDuration = disableAutoFit ? 0 : 1

return (
  <Bounds fit clip observe margin={1.2} maxDuration={boundsMaxDuration}>
    {/* ... */}
  </Bounds>
)
```

**Por que `maxDuration={0}` é crítico:**

- `maxDuration={0}`: Fit INSTANTÂNEO, sem animação visível
- `maxDuration={1}`: Fit com animação de 1 segundo (padrão)
- Sem `maxDuration={0}`, o primeiro modelo aparece pequeno e "cresce" até o
  tamanho correto

**Melhorias Permitidas** (sem quebrar lógica):

- ✅ Otimizações de performance (preload, lazy loading, memo)
- ✅ Melhorias de UX (transições, controles, feedback visual)
- ✅ Refatoração de código (mantendo comportamento)

**Quando Modificar**:

- Se precisar alterar timing do ScrollReveal → Ajustar sincronização
- Se adicionar novos modelos → Lógica atual funciona automaticamente
- Se mudar estrutura do Hero → Garantir que `isScrollRevealReady` continue
  funcionando

**⚠️ AVISO FINAL PARA IA:**

**Se você remover `maxDuration={0}` ou `disableAutoFit`, o problema volta!** **O
primeiro modelo voltará a exibir animação de zoom (bounce/pop-up).** **Esta
lógica foi implementada após horas de debugging e NÃO pode ser removida.**

---

## 6. 🎨 Design System - Regras Rápidas

- **Componentes Base**: Use APENAS componentes de `@gb-locacoes/ui`
  (`packages/ui/src`, baseados em Radix UI).
- **Cor Primária**: Orange-600 (#ea580c).
- **Tipografia**: Inter (sans) + Jost (headings).
- **Responsividade**: Mobile-first. Use os padrões de espaçamento documentados
  em `docs/features/design-system.md`.
- **Z-Index**: Use só os tokens `--layer-*` de
  `packages/design-tokens/src/theme.css`. Nunca invente valores numéricos.
- **CSS** (seção "Arquitetura do CSS" de `docs/features/design-system.md`):
  - O estilo mora no componente (`packages/ui/src/web` ou a slice dona). Global
    só em `packages/frontend/src/app/styles`, para o que não tem componente
    dono. Tokens só em `packages/design-tokens/src`.
  - Camadas `theme, base, components, utilities` (ordem declarada em
    `packages/frontend/src/app/styles/globals.web.css`; a `legacy` saiu na onda
    5). Camada de sobrescrita (`overrides`) é proibida.
  - Tailwind 4 com a semântica da produção (Tailwind 3.4.17): paleta em
    `packages/design-tokens/src/palette.css` e escalas em `scales.css`; classe
    nova confere a paridade (`tests/visual/README.md`, "Paridade com a
    produção").
  - **`!important` é proibido** em CSS, no Tailwind (modificador `!` como
    prefixo ou sufixo) e em estilo inline: tolerância zero (`css-important` do
    `pnpm tokens`, `pnpm lint:css`).
  - Mudança de CSS só termina com `pnpm lint:css` verde e a linha de base visual
    sem diferença não aprovada (`tests/visual/README.md`).

### 🚨 Regras Críticas de Botões

**NUNCA ASSUMA CORES DE BOTÕES**. Sempre consulte
`packages/ui/src/contract/button.ts` (variantes) e
`packages/ui/src/web/Button.web.tsx`:

- **Botões de Confirmação/Salvar**: Use `variant="default"` (resulta em
  `bg-slate-700`)
- **Botões de Cancelar**: Use `variant="outline"`
- **NUNCA** adicione classes customizadas de cor (`bg-blue-600`,
  `bg-orange-600`, etc.) sem consultar primeiro o componente Button e a
  documentação
- **SEMPRE** verifique exemplos existentes no projeto antes de criar novos
  botões

---

## 7. 🏛️ Stack Tecnológico (Resumo)

| Tecnologia     | Versão/Detalhes                                                                                                                                                                                                                                                                                                                    |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estrutura**  | Monorepo pnpm: hosts finos `apps/clients/web` (Next.js) e `apps/clients/mobile` (Expo) sobre `packages/frontend` (FSD), `packages/ui`, `packages/design-tokens`; servidor em `packages/backend`, regras em `packages/domain`, contratos em `packages/contracts`; a raiz legada (`app/`, `lib/`) ainda é o backend das rotas `/api` |
| **Framework**  | Next.js 16.3.6 (App Router, Turbopack); Expo 57 com React Native 0.86.3                                                                                                                                                                                                                                                            |
| **Linguagem**  | TypeScript 5.9.3                                                                                                                                                                                                                                                                                                                   |
| **UI**         | React 19.3.0 + Tailwind CSS 4.3.3 com a paleta e as escalas da produção (Tailwind 3.4.17)                                                                                                                                                                                                                                          |
| **Database**   | PostgreSQL + Prisma 7.10.0 (RLS por locadora nas migrations; nunca `db push`)                                                                                                                                                                                                                                                      |
| **Auth**       | NextAuth.js 4.24.15 (modo `legacy`) e Better Auth 1.7.6 (identidade multi-host), pelo `NEXT_PUBLIC_AUTH_MODE`                                                                                                                                                                                                                      |
| **Pagamentos** | Asaas, uma subconta por locadora (`docs/architecture/adr-saas-subscription.md`)                                                                                                                                                                                                                                                    |
| **State**      | Zustand 5.0.15                                                                                                                                                                                                                                                                                                                     |
| **Testing**    | Vitest + Playwright                                                                                                                                                                                                                                                                                                                |

> **Atenção**: Consulte `docs/references/dependencies.md` antes de atualizar
> qualquer dependência. Há incompatibilidades conhecidas.

---

## 8. 🎯 Objetivo Final

Criar código que seja:

- **📖 Documentado**: Baseado na documentação oficial.
- **🎨 Consistente**: Seguindo o design system.
- **🔒 Seguro**: Com validações e autenticação adequadas.
- **⚡ Performático**: Otimizado para velocidade.
- **♿ Acessível**: Inclusivo para todos os usuários.
- **🧪 Testado**: Coberto por testes adequados.
- **📝 Rastreável**: Com mudanças documentadas no CHANGELOG.

---

_Última atualização: 2026-09-30 | Versão: 3.3 (produto SaaS por assinatura,
`!important` proibido, nomes de teste colocado, segurança de agentes e sem
sobras)_

<!-- BEGIN context-window:contract v2.1.0 sha256=f2a8052f423cc9b133e8aa4eecdbe1d056b85704ce162311544967102c578f9b -->

## Context Window — mandatory product architecture contract

Applies to every product repository that has, or will have, a frontend.
Backend-only services, libraries, automations and creative/media projects keep
their own profile.

1. Topology: `apps/clients/web` (Next.js) and `apps/clients/mobile` (Expo/React
   Native) are thin hosts — routes, bootstrap, configuration and platform
   integration only. They consume workspace packages: `packages/frontend`
   (product frontend, strictly Feature-Sliced Design), `packages/ui`
   (design-system components), `packages/design-tokens` (canonical tokens and
   themes). Add other packages only for a real responsibility. New projects
   start with both clients running on the shared packages.
2. FSD in `packages/frontend/src`: layers
   `app → pages → widgets → features → entities → shared`. A slice imports only
   from strictly lower layers, never from a sibling slice (entities may use `@x`
   cross-import APIs), and only through the other slice's `index.ts`. `shared`
   holds no business rules; `shared/ui` only delegates to `packages/ui`. No
   `export *` public APIs, no global barrel.
3. Foundations: `packages/ui` and `packages/design-tokens` never import
   `packages/frontend` or the clients. Clients import only package entry points
   (`@<scope>/frontend/app`, `@<scope>/frontend/pages/*`, `@<scope>/ui`,
   `@<scope>/design-tokens`) and never each other.
4. Runtime boundaries: universal code imports no `next/*`, `react-dom`,
   `react-native`, Node built-ins or server-only packages. Platform code lives
   in `.web.tsx` / `.native.tsx` variants behind one public contract. Prisma,
   secrets and server-only modules never reach client bundles.
5. Gate: run `pnpm arch` (tools/arch-check.mjs) before finishing frontend work;
   any violation blocks completion.
6. Legacy repositories: when the task authorizes adoption or modernization,
   follow `legacy-code-refactoring` (inventory → characterization tests →
   incremental moves → gate → retire replaced structure). Installing or updating
   skills never rewrites a project.
7. Backend: choose modular monolith or ports-and-adapters with
   `clean-architecture-ddd`; FSD is not applied to backend code. Shared
   contracts live apart from server implementations.
8. Fidelity: do not invent paths, APIs, tokens, colors or a second copy of a
   screen. The web/mobile mirror is one product UI in `packages/frontend`,
   rendered by the thin hosts. If the repository disagrees with this contract,
   the repository wins and the disagreement is reported. Load a skill only
   inside its Operational Contract; leave the others unloaded.

Skills: `multiplatform-platform-architecture` (bootstrap, topology, Next/Expo),
`react-saas-architecture` (FSD rules), `design-system-implementation`,
`legacy-code-refactoring`, `clean-architecture-ddd`, `testing-strategies`.
<!-- END context-window:contract -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` (resolved from this file's directory; in
monorepos the `next` package may not be visible from the repo root) before
writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at
`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a
diff only re-creates the uncommitted change; committing it with your work keeps
the tree clean.

<!-- END:nextjs-agent-rules -->
