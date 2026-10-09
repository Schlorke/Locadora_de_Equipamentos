# w30-20 — pages/grid-motion

- **Índice:** 20
- **Escopo:** `packages/frontend/src/pages/grid-motion`
- **Estado:** intermediate

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para a raiz) nos fontes de produção; já usa `@gb-locacoes/ui`.
- Página universal (`GridMotionPage.tsx`, sem `.web`, sem `next/*` /
  `react-dom`); tela fina mobile já existia em
  `apps/clients/mobile/src/app/grid-motion.tsx`.
- Rota fina web verificada em `apps/clients/web/src/app/grid-motion/page.tsx` —
  já importa o export público; sem ajuste.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; só
  `GridMotionPage.test.tsx`).
- Resultado anexado ao final de `docs/migration/MIGRATION.md`
  (`## w30-20-grid-motion`).

## Exits

- Imports legados: nada a trocar.
- Host web fino: já correto (sem edição).
- Mobile: já presente.
- Contrato de migração: adicionado e exercitado via vitest (platform config).
- Sem edição de arquivos de produção em `packages/` / `apps/` → arch-check /
  token-check não aplicados.
- Migração do slice **não** declarada concluída.
