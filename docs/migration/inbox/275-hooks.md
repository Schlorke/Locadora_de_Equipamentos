# 275-hooks

Dois hooks legados migrados para os slices FSD consumidores. Comportamento
inalterado; só imports e colocação. `use-settings-data` fora do escopo. Estado
intermediate.

```yaml
fatia:
  id: 275-hooks
  estado: intermediate
  conceito: migrar no máximo dois hooks legados de hooks/ para pages FSD
  origem:
    - hooks/use-equipment-list-data.ts
    - hooks/use-emoji-recents.ts
  destino:
    - packages/frontend/src/pages/equipamentos-admin/model/lista.web.ts
    - packages/frontend/src/pages/categorias/model/emoji-recents.ts
    - packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.test.tsx
    - packages/frontend/src/pages/equipamentos-admin/index.ts
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx
    - packages/frontend/src/pages/categorias/index.ts
    - app/playground/icon-customization/page.tsx
  invariantes:
    - id: page-size-admin-9
      prova:
        "lista.web.ts usa EQUIPMENT_LIST_PAGE_SIZE da entity; Lista.web.test
        mantém paginação"
    - id: emoji-storage-key
      prova:
        "emoji-recents.ts STORAGE_KEY === 'gb-locacoes-emoji-recents' e
        MAX_RECENT_EMOJIS === 30"
    - id: next-navigation-web
      prova: "lista.web.ts importa next/navigation (arquivo .web.ts)"
    - id: sem-hooks-legado
      prova:
        "CategoriaDialog.web.test e Lista.web.test não contêm
        @/hooks/use-emoji-recents nem @/hooks/use-equipment-list-data"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin
        packages/frontend/src/pages/categorias"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:59"
  gate:
    arch: pass
    tokens: fail_externo
    violacoes_conhecidas:
      - "token-check: Cartao.native.tsx borderWidth/borderTopWidth 1 (fora da
        fatia 275)"
      - "hooks/use-icon-recents.ts, use-settings.tsx, use-toast.ts,
        use-toast-sonner.ts permanecem legados"
      - "use-settings-data fora do escopo desta fatia"
  aposentado:
    - hooks/use-equipment-list-data.ts
    - hooks/use-emoji-recents.ts
  nao_verificado:
    - "[NOT_VERIFIED: listagem admin equipamentos no browser]"
    - "[NOT_VERIFIED: diálogo de categoria / emoji recents no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
