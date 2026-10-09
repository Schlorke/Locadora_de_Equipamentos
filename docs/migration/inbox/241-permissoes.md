# 241-permissoes

A tela de permissões saiu de `app/admin/permissions/page.tsx`. A rota continua
`/admin/permissions` e o host só renderiza `AdminPermissionsPage`. Os papéis
continuam `ADMIN`, `OPERATOR`, `FINANCIAL` e `CLIENT`. O título continua
Gerenciar Permissões. A nota do administrador e o bloqueio de edição nesse
perfil permanecem. `AdminCard` continua no legado compartilhado. Esta fatia está
em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 241-permissoes
  estado: intermediate
  conceito: tela admin de permissões por perfil
  origem:
    - app/admin/permissions/page.tsx
  destino:
    - packages/frontend/src/pages/permissoes/ui/PermissoesPage.tsx
    - packages/frontend/src/pages/permissoes/index.ts
    - app/admin/permissions/page.tsx
  invariantes:
    - id: papeis-e-titulo
      prova:
        "PermissoesPage.test.tsx: Gerenciar Permissões,
        ADMIN/OPERATOR/FINANCIAL/CLIENT e nota do administrador"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/permissoes/ui/PermissoesPage.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:51"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:51"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:51"
  gate:
    arch: fail
    tokens: pass
    violacoes_conhecidas:
      - "FSD-PUBLIC-API pages/email-admin sem index (fora desta fatia)"
      - "components/admin/admin-card.tsx continua legado compartilhado"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - "o corpo da tela em app/admin/permissions/page.tsx; a rota ficou só com o
      shell"
  nao_verificado:
    - "[NOT_VERIFIED: permissões no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
