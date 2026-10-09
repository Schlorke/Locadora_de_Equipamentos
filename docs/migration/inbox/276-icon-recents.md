# 276-icon-recents

`use-icon-recents` migrado para o slice `pages/categorias` (mesmo padrão do
emoji-recents). Chave de storage e comportamento preservados. Sem `.web.ts` (não
importa `next/*`). Legado apagado com zero imports. Estado intermediate.

```yaml
fatia:
  id: 276-icon-recents
  estado: intermediate
  conceito: migrar hooks/use-icon-recents.ts para pages/categorias
  origem:
    - hooks/use-icon-recents.ts
  destino:
    - packages/frontend/src/pages/categorias/model/icon-recents.ts
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx
    - packages/frontend/src/pages/categorias/index.ts
    - app/playground/icon-customization/page.tsx
  invariantes:
    - id: icon-storage-key
      prova:
        "icon-recents.ts STORAGE_KEY === 'gb-locacoes-icon-recents' e
        MAX_RECENT_ICONS === 18"
    - id: sem-next-import
      prova: "icon-recents.ts é .ts (sem next/*); não .web.ts"
    - id: sem-hooks-legado
      prova:
        "CategoriaDialog.web.test não contém @/hooks/use-icon-recents; rg zero
        imports do legado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/categorias"
      exit: 0
      verificado_em: "2026-09-25 16:03"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:03"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:03"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas: []
  aposentado:
    - hooks/use-icon-recents.ts
  nao_verificado:
    - "[NOT_VERIFIED: diálogo de categoria / icon recents no browser]"
    - "[NOT_VERIFIED: playground/icon-customization no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
