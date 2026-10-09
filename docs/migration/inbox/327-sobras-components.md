# 327-sobras-components

Inventário pós-327 (Node `fs`, walk por `readdirSync`/`withFileTypes`; sem
PowerShell recurse). Em `components/` só restam dois `.ts`/`.tsx` de host:
`scroll-reveal-init.tsx` e `service-worker-register.tsx`. Nenhum outro arquivo
de tela. Pastas vazias sobram. `hooks/` existe e está vazio (nenhum arquivo).
Nada movido nesta fatia. Diário `## 327-carrossel-3d` e linha Unreleased Added
do CHANGELOG (2026-09-25) já existiam — não duplicados. Migração **não**
concluída.

```yaml
fatia:
  id: 327-sobras-components
  estado: intermediate
  conceito: >-
    listar sobras de components/ e hooks/ após 327-carrossel-3d; não mover
    scroll-reveal-init nem service-worker-register
  origem:
    - components/ (inventário)
    - hooks/ (inventário)
  destino: []
  movido: []
  inventario_disco:
    components_ts_tsx:
      - components/scroll-reveal-init.tsx
      - components/service-worker-register.tsx
    components_pastas_vazias:
      - components/admin/dashboard
      - components/admin/equipment-form
      - components/admin/financial
      - components/admin/maintenance
      - components/admin/quotes/dialogs
      - components/admin/rentals
      - components/admin/shared
      - components/dialogs
      - components/terms
      - components/ui
    hooks:
      pasta_existe: true
      arquivos: []
  nao_fez:
    - mover scroll-reveal-init
    - mover service-worker-register
    - apagar pastas vazias
    - duplicar ## 327-carrossel-3d no MIGRATION.md
    - duplicar linha CHANGELOG Unreleased Added
  migracao_concluida: false
```
