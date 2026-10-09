# 260-cartao-admin

O cartão admin compartilhado saiu de `components/admin/admin-card.tsx` para o
widget `cartao-admin`. Variantes `default | elevated | glass | flat`, classes e
cores (`bg-white`, `bg-orange-100`, gradientes gray) preservadas. Callers em
pages frontend e a linha de import em `orcamentos-admin/ui/Calendario.web.tsx`
apontam para o index do widget. Arquivo legado apagado. Esta fatia está em
estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 260-cartao-admin
  estado: intermediate
  conceito: cartão compartilhado das páginas admin
  origem:
    - components/admin/admin-card.tsx
  destino:
    - packages/frontend/src/widgets/cartao-admin/ui/Cartao.tsx
    - packages/frontend/src/widgets/cartao-admin/index.ts
  invariantes:
    - id: variantes-e-cores
      prova:
        "Cartao.test.tsx: default|elevated|glass|flat, hover:scale,
        bg-orange-100, gray-50/100, text-gray-900/600"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cartao-admin/ui/Cartao.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:52"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:52"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:52"
      nota: >-
        8 violações pré-existentes em
        packages/frontend/src/pages/equipamentos-admin (Editar.web.tsx /
        Novo.web.tsx). Nenhuma violação em cartao-admin. Fora do escopo
        exclusivo desta fatia.
  gate:
    arch: pass
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "token-check falha em equipamentos-admin Editar/Novo (fora da fatia 260)"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/admin-card.tsx
  callers_atualizados:
    - packages/frontend/src/pages/permissoes/ui/PermissoesPage.tsx
    - packages/frontend/src/pages/manutencao/ui/ManutencaoPage.web.tsx
    - packages/frontend/src/pages/manutencao/ui/Dialogo.web.tsx
    - packages/frontend/src/pages/logistica/ui/LogisticaPage.web.tsx
    - packages/frontend/src/pages/logistica/ui/Dialogo.web.tsx
    - packages/frontend/src/pages/locacoes/ui/LocacoesPage.web.tsx
    - packages/frontend/src/pages/locacoes/ui/Dialogo.web.tsx
    - packages/frontend/src/pages/financeiro/ui/FinanceiroPage.web.tsx
    - packages/frontend/src/pages/orcamentos-admin/ui/Calendario.web.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cartão admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
