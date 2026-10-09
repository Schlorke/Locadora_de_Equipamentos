# 347-bundle-pos-token

`pnpm bundle:mobile` pós-troca `#9ca3af` → `palette.gray400` em
`category-helpers.native.tsx` (fatias 345/346). Exit **0**. Sem falha de
import/`palette.gray400` no runtime native. Sem correção de código. Sem commit.
Sem `pnpm install`. Sem Prisma. Sem `pnpm test`. Sem conectar no Postgres. Sem
editar carrossel 3D. Sem remover `customConditions` / `moduleSuffixes`. Migração
**não** concluída.

```yaml
fatia:
  id: 347-bundle-pos-token
  estado: intermediate
  conceito: >-
    re-rodar pnpm bundle:mobile após palette.gray400 no native; exit 0; sem fix
    de import
  contexto_anterior:
    - pnpm tokens 0 e pnpm check:tokens 0 após troca hex→palette.gray400
    - pnpm bundle:mobile 0 anterior à troca (pré-345)
  arquivos_editados:
    - docs/migration/inbox/347-bundle-pos-token.md
    - docs/migration/MIGRATION.md
  nao_editado:
    - packages/frontend (código)
    - category-helpers.web.tsx
    - packages/design-tokens
    - carrossel 3D
    - customConditions / moduleSuffixes
    - CHANGELOG.md (sem mudança de código)
  comandos:
    - cmd: pnpm bundle:mobile
      exit: 0
      nota: >-
        expo export android+ios; iOS 1495 modules; Android 1846 modules;
        dist-export; palette.gray400 ok no bundle native
      verificado_em: "2026-09-25 19:17"
  exits_finais:
    bundle_mobile: 0
  correcao_import:
    aplicada: false
    motivo: bundle ok; palette.gray400 resolvido no runtime native
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (Postgres local recusou a senha do compose,
      28P01; não tente de novo)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
