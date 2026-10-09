# 319 — token-check crash (ScriptKind)

Data: 2026-09-25

## Escopo

Corrigir só `tools/token-check.mjs` para o gate voltar a varrer TS/JS sem
exceção. Sem commit, sem `pnpm install`, sem Prisma. Sem editar páginas de
frontend (CatalogPage, Expandidos, Graficos, ScrollStackBenefitCard), carrossel
3D, FilterSelectGroup nem HoverActionMenu. Sem afrouxar `token-check-allow`. Sem
alterar cores de produto.

## Causa

Não é import ESM “quebrado” no sentido de módulo inexistente: `createRequire`
resolve `typescript` corretamente. No **TypeScript 7.0.2** do repo, o entry
principal (`lib/version.cjs`) exporta **apenas** `version` /
`versionMajorMinor`. `ts.ScriptKind` e `ts.createSourceFile` ficam `undefined` →
`TypeError` na linha ~115 de `checkCode`.

`ScriptKind` existe em `typescript/unstable/ast`, mas não há
`createSourceFile(text → AST)` nessa superfície; o sync nativo
(`typescript/unstable/sync`) não é adequado para este gate (spawn do servidor).
A API clássica de compiler ainda está no tree via `typescript@5.9.3`
(dependência transitiva em `.pnpm`).

## Correção

`loadTypeScript` passa a:

1. Usar `require("typescript")` se tiver API clássica (`createSourceFile` +
   `ScriptKind`).
2. Senão, resolver `@typescript/typescript6` ou `typescript@5`/`@6` em
   `node_modules/.pnpm` (sem instalar nada).

Regra `token-check-allow` intacta (comentário na mesma linha ou anterior; motivo
≥ 8 caracteres). Hex/rgb continuam examinados.

## Resultado

```
node tools/token-check.mjs
→ exit 0
→ token gate passed — examined 634 code and 0 CSS files
→ sem exceção; sem violações reais de cor/dimensão
```

Arquivos de produto **não** alterados. Migração **não** declarada concluída.
