# w30-03 — area-cliente

| Campo  | Valor                                      |
| ------ | ------------------------------------------ |
| Índice | 3                                          |
| Escopo | `packages/frontend/src/pages/area-cliente` |
| Estado | intermediate                               |

## O que mudou

- Nenhum import legado (`@/components`, `@/hooks`, `@/lib` ou relativo saindo
  para `components/`/`hooks/` na raiz). Relativos existentes apontam para
  índices públicos de `features/carrinho`, `entities/locacao` e
  `entities/equipamento` (FSD ok).
- Slice é `.web` (`AreaClientePage.web.tsx` + `next/*` / `next-auth`); **não**
  foi criada tela fina em `apps/clients/mobile`.
- Criado `contrato.migracao.test.ts` (não havia `*.test.ts` no slice; o
  `AreaClientePage.web.test.tsx` já existente não foi duplicado em escopo).
- Sem edição de arquivo de produção em `packages/` ou `apps/` → `arch-check` /
  `token-check` não executados.
- Vitest do contrato: passou
  (`pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/pages/area-cliente/contrato.migracao.test.ts`).

## Exits / pendências

- Página permanece web-only (next-auth, next/image, next/link); universalização
  e host mobile ficam fora deste passo.
- `cn` local inline e dependências de plataforma web ainda no componente — não
  tocadas (fora do escopo de imports legados).
- Migração do slice **não** declarada concluída.
