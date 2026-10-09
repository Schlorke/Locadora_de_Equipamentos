# w30-09 — contato

- **Índice:** 9
- **Escopo:** `packages/frontend/src/pages/contato`
- **Estado:** intermediate

## O que mudou

- Imports legados (`@/components`, `@/hooks`, `@/lib`, relativos para
  `components/`/`hooks/` na raiz): nenhum encontrado; `ContatoPage.tsx` já
  importa via FSD (`entities/configuracao`, `features/enviar-contato`,
  `shared/ui`).
- Arquivos protegidos do carrossel 3D: não tocados.
- Página universal (sem `.web`, sem `next/*` / `react-dom` no módulo de
  produção): tela fina mobile já existia em
  `apps/clients/mobile/src/app/contato.tsx` — nada criado.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; havia só
  `ContatoPage.test.tsx`).

## Exits / notas

- Nenhum rewrite de import necessário.
- Sem violação FSD a anotar neste slice.
- Sem edição de arquivo de produção em `packages/` ou `apps/` nesta rodada →
  `arch-check` / `token-check` não executados.
- Teste de contrato executado com `vitest.platform.config.ts`.
- Migração do slice **não** declarada como concluída.
