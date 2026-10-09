# 302-admin

Um `.tsx` com implementação própria saiu de `components/admin/logistics/` para o
slice `pages/logistica` (já importava `utils`/`types`). Textos de status e
endereço preservados (`Não definido`, `Agendada`, `Entrega`/`Coleta`). Legado
apagado com zero imports. Sidebars/headers/órfãos ficaram fora: headers na lista
de pulo; sidebars geram 121 violações `token-check` ao entrar em
`packages/frontend` (literais rgba fora do escopo em `components/`); órfãos sem
slice que já importe. Estado intermediate.

## Restantes em `components/admin/**/*.tsx`

- `admin-desktop-header.tsx` (pulo: header)
- `admin-header-actions.tsx` (pulo: header)
- `admin-header.tsx` (pulo: header; órfão)
- `admin-mobile-header.tsx` (pulo: header)
- `admin-sidebar.tsx` (widget compartilhado; bloqueado por token-check)
- `mobile-sidebar.tsx` (idem)
- `gantt-view.tsx` (órfão, zero imports)
- `hero-carousel-manager.tsx` (órfão; settings já movido)
- `logistics-calendar.tsx` (órfão; page usa `widgets/calendario`)
- `mini-carousel.tsx` (órfão)

```yaml
fatia:
  id: 302-admin
  estado: intermediate
  conceito: sobras admin — utilidades logística para pages/logistica
  origem:
    - components/admin/logistics/utils.tsx
    - components/admin/logistics/types.ts
  destino:
    - packages/frontend/src/pages/logistica/ui/Utilidades.tsx
    - packages/frontend/src/pages/logistica/model/tipos.ts
    - packages/frontend/src/pages/logistica/index.ts
  invariantes:
    - id: textos-utilidades
      prova:
        "Utilidades.test.tsx: Não definido, Data inválida, Endereço não
        informado, Agendada, Entrega, Coleta"
    - id: sem-legado-logistics
      prova:
        "Tabela/Dialogo/carga importam ../model/tipos e ./Utilidades; zero
        components/admin/logistics"
    - id: carrossel-3d-intacto
      prova:
        "nenhum arquivo equipment-3d-carousel / model-viewer / lazy-3d-carousel
        alterado"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica"
      exit: 0
      verificado_em: "2026-09-25 16:44"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:44"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:44"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
    violacoes_conhecidas:
      - "sidebars admin permanecem em components/ (token-check 121 literais se
        movidos sem allow)"
      - "headers admin pulados nesta fatia"
      - "órfãos gantt/logistics-calendar/mini-carousel/hero-carousel-manager sem
        importer FSD"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/logistics/utils.tsx
    - components/admin/logistics/types.ts
  callers_atualizados:
    - packages/frontend/src/pages/logistica/model/carga.ts
    - packages/frontend/src/pages/logistica/ui/Tabela.web.tsx
    - packages/frontend/src/pages/logistica/ui/Dialogo.web.tsx
    - packages/frontend/src/pages/logistica/index.ts
    - packages/frontend/src/pages/logistica/ui/Tabela.web.test.tsx
    - packages/frontend/src/pages/logistica/ui/Utilidades.test.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /admin/logistics no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
