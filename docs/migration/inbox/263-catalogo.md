# 263-catalogo

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

`app/equipamentos/page.tsx` já é shell fino: lê `useSearchParams`, monta
adapters (`Image`, `Link`, `AdminFilterCard`, `SmartPagination`,
`categoryBadge`) e renderiza `EquipamentosPage` de
`@gb-locacoes/frontend/pages/equipamentos`. O corpo da listagem pública (busca,
filtro de categoria, grade, paginação com `itemsPerPage = 9`) já vive em
`packages/frontend/src/pages/equipamentos`. O filtro público (`filterEquipments`
/ `paginate` em `entities/equipamento`) permanece separado do filtro admin.

Fora do escopo desta fatia (intactos): `app/admin/equipamentos/**`,
`app/equipamentos/[id]`, carrossel 3D.

```yaml
fatia:
  id: 263-catalogo
  estado: bloqueado
  conceito: catálogo público de equipamentos (shell /equipamentos)
  motivo: "rota já é shell; pages/equipamentos já é a tela inteira; page size 9"
  origem:
    - app/equipamentos/page.tsx
  destino:
    - packages/frontend/src/pages/equipamentos
  invariantes:
    - "filtro público separado do filtro admin"
    - "page size público = 9"
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    violacoes_conhecidas:
      - "app/admin/equipamentos continua fora desta fatia"
      - "app/equipamentos/[id] continua fora desta fatia"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
