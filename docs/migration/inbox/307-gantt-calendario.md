# 307-gantt-calendario

Quatro órfãos de `components/admin/` foram para FSD. Gantt e logistics-calendar
para `pages/logistica` (domínio logístico; page real usa `widgets/calendario`).
`mini-carousel` (órfão genérico com `next/image`) ganhou widget novo.
`hero-carousel-manager` não importa equipment-3d-carousel / model-viewer /
scroll-reveal → `pages/configuracoes`. Calendar passou a vir de
`widgets/seletor-data` (sem deep import quebrado). Legado apagado com zero
imports. Estado intermediate.

## Movimentos

| Origem                                       | Destino                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| `components/admin/gantt-view.tsx`            | `pages/logistica/ui/GanttView.web.tsx`               |
| `components/admin/logistics-calendar.tsx`    | `pages/logistica/ui/LogisticsCalendar.web.tsx`       |
| `components/admin/mini-carousel.tsx`         | `widgets/mini-carousel/ui/MiniCarousel.web.tsx`      |
| `components/admin/hero-carousel-manager.tsx` | `pages/configuracoes/ui/HeroCarouselManager.web.tsx` |

```yaml
fatia:
  id: 307-gantt-calendario
  estado: intermediate
  conceito:
    órfãos gantt / logistics-calendar / mini-carousel / hero-carousel-manager
  origem:
    - components/admin/gantt-view.tsx
    - components/admin/logistics-calendar.tsx
    - components/admin/mini-carousel.tsx
    - components/admin/hero-carousel-manager.tsx
  destino:
    - packages/frontend/src/pages/logistica/ui/GanttView.web.tsx
    - packages/frontend/src/pages/logistica/ui/LogisticsCalendar.web.tsx
    - packages/frontend/src/pages/logistica/ui/GanttCalendar.web.test.tsx
    - packages/frontend/src/pages/logistica/index.ts
    - packages/frontend/src/widgets/mini-carousel/ui/MiniCarousel.web.tsx
    - packages/frontend/src/widgets/mini-carousel/ui/MiniCarousel.web.test.tsx
    - packages/frontend/src/widgets/mini-carousel/index.ts
    - packages/frontend/src/pages/configuracoes/ui/HeroCarouselManager.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/HeroCarouselManager.web.test.tsx
    - packages/frontend/src/pages/configuracoes/index.ts
  invariantes:
    - id: gantt-modos
      prova: "GanttCalendar.web.test.tsx: Diário / Semanal / Mensal / Hoje"
    - id: logistics-rotulos
      prova:
        "GanttCalendar.web.test.tsx: Agenda de Entregas e Coletas, Agendada,
        Entrega, Coleta"
    - id: calendar-via-seletor
      prova:
        "GanttView e LogisticsCalendar importam ../../../widgets/seletor-data"
    - id: hero-sem-3d
      prova:
        "HeroCarouselManager.web.test.tsx: sem
        equipment-3d-carousel|model-viewer|lazy-3d-carousel|scroll-reveal"
    - id: legado-zero
      prova:
        "Test-Path dos quatro components/admin/* = False; zero imports de
        produto"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/logistica
        packages/frontend/src/widgets/mini-carousel
        packages/frontend/src/pages/configuracoes/ui/HeroCarouselManager.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:52"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:53"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 16:53"
      nota: >-
        2 violações em widgets/cabecalho-admin-barra (BarraDesktop/BarraMobile
        rgba) — fora da fatia 307; headers admin proibidos neste escopo. Nenhum
        arquivo desta fatia aparece nas violações.
  gate:
    arch: pass
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "token: cabecalho-admin-barra BarraDesktop/BarraMobile rgba (fora da
        fatia; headers proibidos)"
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/admin/gantt-view.tsx
    - components/admin/logistics-calendar.tsx
    - components/admin/mini-carousel.tsx
    - components/admin/hero-carousel-manager.tsx
  callers_atualizados:
    - packages/frontend/src/pages/logistica/index.ts
    - packages/frontend/src/pages/configuracoes/index.ts
  nao_verificado:
    - "[NOT_VERIFIED: consumidores futuros no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
