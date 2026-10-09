# 286-hooks

Fatia **bloqueada**. `hooks/` existe no disco, mas está **vazio** (0 arquivos).

Estado no disco (working tree):

- Pasta `hooks/` presente, sem arquivos.
- Git: 27 entradas ainda rastreadas como `D` (deleted) — `use-admin-badges`,
  `use-cart-notifications`, `use-cart-sync`, `use-categories-data`,
  `use-client-area-badge`, `use-dashboard-data`, `use-debounce`,
  `use-email-page`, `use-emoji-recents`, `use-equipment-list-data`,
  `use-financial-data`, `use-financial-entry-details`, `use-icon-recents`,
  `use-logistics-data`, `use-maintenance-data`, `use-mobile`,
  `use-notifications`, `use-public-settings`, `use-quote-details`,
  `use-quote-form`, `use-quotes-data`, `use-rentals-data`, `use-settings-data`,
  `use-settings`, `use-toast-sonner`, `use-toast`, `useHasHover`.

Migração dos hooks já ocorreu em fatias anteriores (ex.: 239-debounce,
240-email, 244-categorias, 275-hooks, 276-icon-recents, 277-use-settings,
278-toast e correlatas no diário principal). Não há até 4 arquivos remanescentes
para mover.

Nenhum código de produto foi alterado. Gates (Vitest platform, arch-check,
token-check) não foram executados: não há movimento a validar.

```yaml
fatia:
  id: 286-hooks
  estado: bloqueado
  conceito: migrar até 4 hooks remanescentes de hooks/ para slices FSD
  origem: []
  destino: []
  motivo_bloqueio: >-
    hooks/ existe mas está vazio (0 arquivos no working tree). Todos os hooks
    rastreados já aparecem como deleted (D) no git status. Regra da fatia: se
    hooks/ não existir ou estiver vazio, inbox bloqueado e PARE.
  invariantes: []
  comandos: []
  gate:
    arch: nao_aplicavel
    tokens: nao_aplicavel
    vitest_platform: nao_aplicavel
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm exec vitest run --config vitest.platform.config.ts]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
