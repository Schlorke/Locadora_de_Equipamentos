# w30-23 — home

- **Índice:** 23
- **Escopo:** `packages/frontend/src/pages/home`
- **Estado:** intermediate

## O que mudou

- Imports legados (`@/components`, `@/hooks`, `@/lib`, relativos para
  `components/`/`hooks/` na raiz): nenhum encontrado nos fontes de produção
  (`index.ts`, `ui/HomePage.web.tsx`, `model/hero-settings.ts`). Imports já
  apontam para widgets/entities FSD (`widgets/hero`, `widgets/home-cliente`,
  `widgets/por-que-escolher`, `widgets/contato-home`,
  `widgets/dados-estruturados`, `entities/configuracao`) e `next/dynamic`.
- Nenhuma troca de import realizada.
- Arquivos protegidos do carrossel 3D: não tocados.
- Página **não** universal: export público `HomePage` vem de `HomePage.web.tsx`
  e o módulo importa `next/dynamic` — tela fina mobile **não** criada (regra: se
  for `.web`, não criar mobile). Já existe
  `apps/clients/mobile/src/app/index.tsx`, mas usa `CatalogPage`, não este
  slice.
- Host web: `apps/clients/web/src/app/page.tsx` já é adapter fino (`HomePage`,
  `buildHeroInitialSettings`, `getLocalBusinessData` de
  `@gb-locacoes/frontend/pages/home` + Prisma no shell) — **não** alterado.
- `contrato.migracao.test.ts` **não** criado: o slice já possui
  `model/hero-settings.test.ts` (`*.test.ts`) e também
  `ui/HomePage.web.test.tsx` — não duplicar.
- Sem edição de arquivo de produção em `packages/` ou `apps/` nesta rodada →
  `arch-check` / `token-check` não executados.
- Vitest do slice não reexecutado (nenhum teste novo).
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-23-home`).

## Exits / notas

- Nenhum rewrite de import necessário.
- Sem violação FSD a anotar neste slice (imports de page → widgets/entities são
  permitidos).
- Rota fina web `/` já correta; nada a ajustar no host.
- Migração do slice **não** declarada como concluída.
