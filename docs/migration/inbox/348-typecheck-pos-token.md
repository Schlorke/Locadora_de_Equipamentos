# 348-typecheck-pos-token

`pnpm typecheck` e `pnpm arch` pós-troca `#9ca3af` → `palette.gray400` em
`category-helpers.native.tsx` (fatias 345–347). Ambos exit **0**. Sem falha de
tipo em `palette.gray400`. Sem correção de import/tipo. Sem commit. Sem
`pnpm install`. Sem Prisma. Sem `pnpm test`. Sem conectar no Postgres. Sem
editar carrossel 3D. Sem remover `customConditions` / `moduleSuffixes`. Migração
**não** concluída.

```yaml
fatia:
  id: 348-typecheck-pos-token
  estado: intermediate
  conceito: >-
    re-rodar pnpm typecheck e pnpm arch após palette.gray400 no native; ambos
    exit 0; sem fix de tipo/import
  contexto_anterior:
    - pnpm tokens 0, pnpm check:tokens 0, pnpm bundle:mobile 0 após gray400
    - pnpm typecheck 0 e pnpm arch 0 anteriores à linha gray400
  arquivos_editados:
    - docs/migration/inbox/348-typecheck-pos-token.md
    - docs/migration/MIGRATION.md
  nao_editado:
    - packages/frontend (código)
    - category-helpers.native.tsx
    - packages/design-tokens
    - carrossel 3D
    - customConditions / moduleSuffixes
    - CHANGELOG.md (sem mudança de código)
  comandos:
    - cmd: pnpm typecheck
      exit: 0
      nota: >-
        tsc ui + ui.native + frontend + web + mobile; palette.gray400 tipado ok
      verificado_em: "2026-09-25 19:18"
    - cmd: pnpm arch
      exit: 0
      nota: architecture gate passed (5 packages)
      verificado_em: "2026-09-25 19:18"
  exits_finais:
    pnpm_typecheck: 0
    pnpm_arch: 0
  correcao_tipo_ou_import:
    aplicada: false
    motivo: typecheck ok; gray400 já no tipo exportado de design-tokens
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (Postgres local recusou a senha do compose,
      28P01; não tente de novo)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
