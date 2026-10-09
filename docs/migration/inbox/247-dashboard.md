# 247-dashboard

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

`app/admin/dashboard/page.tsx` já é shell fino: só importa e renderiza
`AdminDashboard` de `@gb-locacoes/frontend/pages/dashboard`. O slice
`packages/frontend/src/pages/dashboard` já é a tela inteira (carga, grades,
métricas, gráficos, KPIs, destaques, atalhos, recentes e overlays). A migração
equivalente já consta em `188-dashboard-admin` / `189-carga-dashboard`.

`app/admin/page.tsx` não é a tela do dashboard admin (é entrada/redirect via
`admin-entrada`). `app/page.tsx` da home pública permanece fora do escopo.

```yaml
fatia:
  id: 247-dashboard
  estado: bloqueado
  conceito: dashboard administrativo (shell /admin/dashboard)
  motivo: "rota já é shell; pages/dashboard já é a tela inteira"
  origem:
    - app/admin/dashboard/page.tsx
  destino:
    - packages/frontend/src/pages/dashboard
  invariantes: []
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
