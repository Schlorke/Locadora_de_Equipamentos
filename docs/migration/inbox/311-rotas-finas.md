# 311-rotas-finas

Oito rotas finas novas no host web (`apps/clients/web`), espelhando exports já
existentes em `@gb-locacoes/frontend/pages/*` (todos `.web`). Nenhum espelho
mobile nesta fatia — índices só reexportam módulos `.web`. Nenhuma UI copiada.
Carrossel 3D e `components/` intocados. `app/` da raiz intocado. Estado
**intermediate**. Migração **não** conforme nem concluída.

```yaml
fatia:
  id: 311-rotas-finas
  estado: intermediate
  conceito: >-
    rotas finas faltantes no host web para páginas admin já exportadas como
    .web; limite 8 URLs; sem espelho mobile
  origem:
    - app/admin/categorias/page.tsx
    - app/admin/email/page.tsx
    - app/admin/equipamentos/page.tsx
    - app/admin/equipamentos/novo/page.tsx
    - app/admin/equipamentos/[id]/page.tsx
    - app/admin/equipamentos/[id]/editar/page.tsx
    - app/admin/financeiro/page.tsx
    - app/admin/logistics/page.tsx
  destino:
    - apps/clients/web/src/app/admin/categorias/page.tsx
    - apps/clients/web/src/app/admin/email/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/novo/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/[id]/page.tsx
    - apps/clients/web/src/app/admin/equipamentos/[id]/editar/page.tsx
    - apps/clients/web/src/app/admin/financeiro/page.tsx
    - apps/clients/web/src/app/admin/logistics/page.tsx
  movido: []
  criado:
    urls_web:
      - /admin/categorias → pages/categorias (AdminCategoriesPage .web)
      - /admin/email → pages/email-admin (AdminEmailPage .web)
      - /admin/equipamentos → pages/equipamentos-admin (AdminEquipmentsPage
        .web)
      - /admin/equipamentos/novo → pages/equipamentos-admin (NovoEquipamentoPage
        .web)
      - /admin/equipamentos/[id] → pages/equipamentos-admin
        (EquipmentDetailsPage .web)
      - /admin/equipamentos/[id]/editar → pages/equipamentos-admin
        (EditarEquipamentoPage .web)
      - /admin/financeiro → pages/financeiro (AdminFinanceiroPageWrapper .web)
      - /admin/logistics → pages/logistica (AdminLogisticsPage .web)
    espelho_mobile_universal: []
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel,
        scroll-reveal-init e service-worker-register não tocados
    - id: sem-apagar-app
      prova: app/ da raiz não tocado
    - id: sem-prisma
      prova: schema Prisma, lib/prisma e rotas de API não tocados
    - id: rotas-finas
      prova: >-
        hosts novos só importam @gb-locacoes/frontend/pages/<slice> e retornam o
        export já existente; sem UI duplicada
    - id: sem-catch-all
      prova: nenhum [[...rota]] criado
    - id: mobile-sem-web-only
      prova: >-
        nenhuma das 8 URLs espelhada no mobile porque o index exporta
        implementação .web
    - id: sem-duplicar-310
      prova: >-
        /api-docs, /admin/teste-toast, /grid-motion,
        /playground/icon-customization, /admin/permissions, /playground,
        /orcamento, /admin/dashboard não recriadas
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:02"
      nota: architecture gate passed (5 packages)
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:02"
      nota: token gate passed; fatia não introduziu literais de cor
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: >-
        só page.tsx finos novos; sem arquivo de teste novo
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_sem_teste_novo
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "service-worker-register continua em components/"
  aposentado: []
  callers_atualizados: []
  nao_fez:
    - mover carrossel 3D / model-viewer / scroll-reveal / SW
    - espelho mobile das 8 URLs (.web-only)
    - rotas ainda só na raiz (abaixo)
    - backend / typecheck / build completo / closeout
    - editar docs/migration/MIGRATION.md ou CHANGELOG.md
  bloqueio_restante:
    rotas_web_ainda_faltando_com_export:
      - /admin/maintenance
      - /admin/orcamentos
      - /admin/orcamentos/[id]
      - /admin/rentals
      - /admin/settings
      - /admin/whatsapp
      - /area-cliente
      - /area-cliente/enderecos
      - /area-cliente/historico
      - /area-cliente/historico/[id]
      - /area-cliente/notificacoes
      - /area-cliente/perfil
      - /equipamentos-scroll
    rotas_bloqueadas_host_fino:
      - /equipamentos/[id] — Prisma + generateMetadata no shell da raiz
      - / (home) — Prisma + carrossel 3D no host legado
      - /sobre na raiz — injeta Equipment3DCarousel (web host já tem stub)
    legado_proposital:
      - components/equipment-3d-carousel.tsx
      - components/scroll-reveal-init.tsx
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
      - components/service-worker-register.tsx
    closeout_nao_rodado:
      - typecheck
      - pnpm test com TEST_DATABASE_URL
      - pnpm build
      - pnpm build:web
      - pnpm bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser nas 8 URLs novas]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
