# 243-equipamentos-admin

As telas admin de equipamentos saíram de `app/admin/equipamentos/**` para o
slice `equipamentos-admin`. As quatro rotas ficaram shells com as mesmas URLs. O
dialog `VerEquipamento` permaneceu. O page size **9** da listagem admin continua
em `EQUIPMENT_LIST_PAGE_SIZE` (`entities/equipamento`) via
`hooks/use-equipment-list-data` — separado do catálogo público. O seletor de
período foi colocalizado em `SeletorPreco.tsx` (cópia intermediária de
`EquipamentoPeriodo`) para não criar import entre pages irmãs. O calendário de
perdas usa `widgets/seletor-data`. Catálogo público `app/equipamentos` e o
carrossel 3D não foram tocados. Estado intermediate.

```yaml
fatia:
  id: 243-equipamentos-admin
  estado: intermediate
  conceito: páginas admin de equipamentos (lista, novo, detalhe, editar)
  origem:
    - app/admin/equipamentos/page.tsx
    - app/admin/equipamentos/novo/page.tsx
    - app/admin/equipamentos/[id]/page.tsx
    - app/admin/equipamentos/[id]/editar/page.tsx
  destino:
    - packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Novo.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Detalhe.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/Editar.web.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/SeletorPreco.tsx
    - packages/frontend/src/pages/equipamentos-admin/ui/VerEquipamento.web.tsx
  invariantes:
    - id: urls-admin
      prova:
        "rotas /admin/equipamentos, /novo, /[id], /[id]/editar permanecem shells"
    - id: page-size-admin-9
      prova:
        "EQUIPMENT_LIST_PAGE_SIZE === 9 em entities/equipamento; não unido ao
        catálogo público"
    - id: ver-equipamento-preservado
      prova: "VerEquipamento.web.tsx permanece no slice"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/equipamentos-admin"
      exit: 0
      verificado_em: "2026-09-25 15:54"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:54"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:54"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "hooks/use-equipment-list-data.ts continua legado e alimenta Lista.web"
      - "components/admin/equipment-form/** continua legado (novo/editar)"
      - "SeletorPreco.tsx é cópia intermediária de EquipamentoPeriodo (evitar
        FSD-SLICE)"
      - "app/equipamentos (catálogo público) e carrossel 3D fora desta fatia"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: admin equipamentos no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
