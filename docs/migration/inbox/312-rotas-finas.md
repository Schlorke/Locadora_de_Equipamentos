# 312-rotas-finas

Treze rotas finas novas no host web (`apps/clients/web`), cobrindo **todas** as
URLs que o inbox 311 listou em `rotas_web_ainda_faltando_com_export`. Cada
`page.tsx` só importa export já existente em `@gb-locacoes/frontend/pages/*`
(todos `.web`). Nenhum espelho mobile — índices só reexportam módulos `.web`.
Nenhuma UI copiada. Carrossel 3D e `components/` intocados. `app/` da raiz
intocado. Estado **intermediate**. Migração **não** conforme nem concluída.

```yaml
fatia:
  id: 312-rotas-finas
  estado: intermediate
  conceito: >-
    rotas finas faltantes do inbox 311 no host web; 13 URLs com export .web; sem
    espelho mobile
  origem:
    - app/admin/maintenance/page.tsx
    - app/admin/orcamentos/page.tsx
    - app/admin/orcamentos/[id]/page.tsx
    - app/admin/rentals/page.tsx
    - app/admin/settings/page.tsx
    - app/admin/whatsapp/page.tsx
    - app/area-cliente/page.tsx
    - app/area-cliente/enderecos/page.tsx
    - app/area-cliente/historico/page.tsx
    - app/area-cliente/historico/[id]/page.tsx
    - app/area-cliente/notificacoes/page.tsx
    - app/area-cliente/perfil/page.tsx
    - app/equipamentos-scroll/page.tsx
  destino:
    - apps/clients/web/src/app/admin/maintenance/page.tsx
    - apps/clients/web/src/app/admin/orcamentos/page.tsx
    - apps/clients/web/src/app/admin/orcamentos/[id]/page.tsx
    - apps/clients/web/src/app/admin/rentals/page.tsx
    - apps/clients/web/src/app/admin/settings/page.tsx
    - apps/clients/web/src/app/admin/whatsapp/page.tsx
    - apps/clients/web/src/app/area-cliente/page.tsx
    - apps/clients/web/src/app/area-cliente/enderecos/page.tsx
    - apps/clients/web/src/app/area-cliente/historico/page.tsx
    - apps/clients/web/src/app/area-cliente/historico/[id]/page.tsx
    - apps/clients/web/src/app/area-cliente/notificacoes/page.tsx
    - apps/clients/web/src/app/area-cliente/perfil/page.tsx
    - apps/clients/web/src/app/equipamentos-scroll/page.tsx
  movido: []
  criado:
    urls_web:
      - /admin/maintenance → pages/manutencao (AdminMaintenancePage .web)
      - /admin/orcamentos → pages/orcamentos-admin (AdminQuotesPageWrapper .web)
      - /admin/orcamentos/[id] → pages/orcamentos-admin (QuoteDetailPage .web +
        params)
      - /admin/rentals → pages/locacoes (AdminRentalsPage .web)
      - /admin/settings → pages/configuracoes (AdminConfiguracoesPage .web)
      - /admin/whatsapp → pages/whatsapp-admin (AdminWhatsAppPage .web)
      - /area-cliente → pages/area-cliente (AreaClientePage .web)
      - /area-cliente/enderecos → pages/enderecos (EnderecosPage .web)
      - /area-cliente/historico → pages/historico (HistoricoPage .web)
      - /area-cliente/historico/[id] → pages/historico-detalhe
        (RentalDetailsPage .web)
      - /area-cliente/notificacoes → pages/notificacoes (NotificacoesPage .web)
      - /area-cliente/perfil → pages/perfil (PerfilPage .web)
      - /equipamentos-scroll → pages/equipamentos-scroll (EquipamentosScrollPage
        .web)
    espelho_mobile_universal: []
  pulou:
    - nenhuma URL da lista 311 já existia no host web (confirmado no disco)
    - nenhuma URL da lista 311 sem export no pacote
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
        nenhuma das 13 URLs espelhada no mobile porque o index exporta
        implementação .web
    - id: sem-duplicar-310-311
      prova: >-
        rotas das fatias 310/311 não recriadas; só as 13 faltantes do
        bloqueio_restante do inbox 311
  comandos:
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:05"
      nota: architecture gate passed (5 packages)
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:05"
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
    - espelho mobile das 13 URLs (.web-only)
    - migrar /equipamentos/[id], / (home Prisma+3D), /sobre com 3D
    - backend / typecheck / build completo / closeout
    - editar docs/migration/MIGRATION.md ou CHANGELOG.md
  bloqueio_restante:
    rotas_web_ainda_faltando_com_export: []
    rotas_bloqueadas_host_fino:
      - /equipamentos/[id] — Prisma + generateMetadata no shell da raiz (única
        page de produto ainda só na raiz sem counterpart fino no host web)
      - / (home) — Prisma + carrossel 3D no host legado (web host já tem stub)
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
    - "[NOT_VERIFIED: browser nas 13 URLs novas]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
