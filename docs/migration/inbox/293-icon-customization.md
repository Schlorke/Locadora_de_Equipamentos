# 293-icon-customization

Corpo de `/playground/icon-customization` foi para
`pages/playground/ui/IconCustomizationPage.tsx`. Rota virou shell fino. Widget
`personalizar-icone` reutilizado (não recriado). Hooks de recentes
(`emoji-recents` / `icon-recents`) passaram do slice `pages/categorias` para o
widget, com as mesmas chaves de storage. Sem `next/*` (`.tsx` universal). Sem
Prisma no frontend. Carrossel 3D intocado. Estado intermediate.

```yaml
fatia:
  id: 293-icon-customization
  estado: intermediate
  conceito: page.tsx gorda → shell + IconCustomizationPage em pages/playground
  origem:
    - app/playground/icon-customization/page.tsx
    - packages/frontend/src/pages/categorias/model/emoji-recents.ts
    - packages/frontend/src/pages/categorias/model/icon-recents.ts
  destino:
    - packages/frontend/src/pages/playground/ui/IconCustomizationPage.tsx
    - packages/frontend/src/pages/playground/ui/IconCustomizationPage.test.tsx
    - packages/frontend/src/pages/playground/index.ts
    - packages/frontend/src/widgets/personalizar-icone/model/emoji-recents.ts
    - packages/frontend/src/widgets/personalizar-icone/model/icon-recents.ts
    - packages/frontend/src/widgets/personalizar-icone/index.ts
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.test.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx
    - packages/frontend/src/pages/categorias/index.ts
    - app/playground/icon-customization/page.tsx
  invariantes:
    - id: url-preservada
      prova: "URL /playground/icon-customization inalterada"
    - id: shell-fino
      prova:
        "app shell só importa @gb-locacoes/frontend/pages/playground e retorna
        IconCustomizationPage"
    - id: widget-reutilizado
      prova:
        "IconCustomizationPage importa IconCustomizationBlock de
        widgets/personalizar-icone; widget não recriado"
    - id: storage-keys
      prova:
        "icon-recents STORAGE_KEY === 'gb-locacoes-icon-recents' (max 18);
        emoji-recents === 'gb-locacoes-emoji-recents' (max 30)"
    - id: sem-next-import
      prova: "IconCustomizationPage.tsx é .tsx (sem next/*); não .web.tsx"
    - id: sem-prisma-frontend
      prova: "slice sem import de prisma/@prisma"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
    - id: nao-tocou-playground-raiz
      prova: "app/playground/page.tsx intocado nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/playground
        packages/frontend/src/widgets/personalizar-icone
        packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:20"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:20"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:20"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - packages/frontend/src/pages/categorias/model/emoji-recents.ts
    - packages/frontend/src/pages/categorias/model/icon-recents.ts
  callers_atualizados:
    - app/playground/icon-customization/page.tsx
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/pages/categorias/index.ts
  nao_verificado:
    - "[NOT_VERIFIED: /playground/icon-customization no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
