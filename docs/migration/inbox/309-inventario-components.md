# 309-inventario-components

Inventário em disco de `components/` (Node `fs.readdirSync`, profundidade
limitada, sem PowerShell `-Recurse`). Só restam implementações reais nos quatro
arquivos 3D/scroll-reveal proibidos e no registro do service worker (host).
Pastas `admin/`, `dialogs/` e `terms/` existem vazias (sem `.ts`/`.tsx`).
Nenhuma fatia de produto segura para mover. Estado **blocked**. Migração de
`components/` **não** declarada concluída — o carrossel 3D e o SW ficam no
legado até fatia dedicada. `CHANGELOG.md` e `MIGRATION.md` intocados.

```yaml
fatia:
  id: 309-inventario-components
  estado: blocked
  conceito: >-
    inventariar components/ e mover próxima fatia segura; bloqueado porque só
    restam 3D/scroll-reveal + ServiceWorkerRegister
  origem:
    - components/ (inventário completo no disco)
  destino: []
  movido: []
  inventario_disco:
    arquivos_com_implementacao:
      - path: components/equipment-3d-carousel.tsx
        linhas: 387
        motivo_nao_mover: critico-3d-sincronizacao-scroll-reveal
      - path: components/scroll-reveal-init.tsx
        linhas: 890
        motivo_nao_mover: critico-scroll-reveal
      - path: components/ui/lazy-3d-carousel.tsx
        linhas: 128
        motivo_nao_mover: lazy-wrapper-carrossel-3d
      - path: components/ui/model-viewer.tsx
        linhas: 572
        motivo_nao_mover: model-viewer-bounds-critico
      - path: components/service-worker-register.tsx
        linhas: 34
        motivo_nao_mover: service-worker-fica-no-host
    pastas_vazias_sem_ts_tsx:
      - components/admin/
      - components/admin/dashboard/
      - components/admin/equipment-form/
      - components/admin/financial/
      - components/admin/maintenance/
      - components/admin/quotes/
      - components/admin/quotes/dialogs/
      - components/admin/rentals/
      - components/admin/shared/
      - components/dialogs/
      - components/terms/
    ui_com_apenas_3d:
      - components/ui/lazy-3d-carousel.tsx
      - components/ui/model-viewer.tsx
  invariantes:
    - id: sem-mover-3d
      prova: >-
        equipment-3d-carousel, model-viewer, lazy-3d-carousel e
        scroll-reveal-init não foram editados nem movidos
    - id: sem-mover-service-worker
      prova: components/service-worker-register.tsx permanece no host
    - id: sem-apagar-app
      prova: app/ não tocado
    - id: sem-prisma
      prova: schema Prisma, lib/prisma e rotas de API não tocados
    - id: sem-tocar-fatias-306-307
      prova: >-
        cabecalho-admin-barra, Gantt/LogisticsCalendar, mini-carousel e
        HeroCarouselManager não tocados
    - id: inventorio-so-node-fs
      prova: >-
        inventário via node fs.readdirSync/existsSync em components/ apenas; sem
        Get-ChildItem -Recurse
  comandos:
    - cmd: >-
        node -e "fs.readdirSync inventário components/ profundidade limitada"
      exit: 0
      verificado_em: "2026-09-25 16:55"
      nota: 5 arquivos .ts/.tsx com implementação; 0 reexports de produto
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 16:56"
      nota: architecture gate passed (5 packages); sem violação nesta fatia
    - cmd: node tools/token-check.mjs
      exit: 0
      verificado_em: "2026-09-25 16:56"
      nota: token gate passed; fatia não alterou código de produto
    - cmd: pnpm exec vitest run --config vitest.platform.config.ts
      exit: nao_executado
      nota: >-
        sem movimento de código nesta fatia; vitest de caracterização adiado até
        fatia que mova os 3D/SW
  gate:
    arch: pass
    tokens: pass
    vitest_platform: skipped_sem_movimento
    violacoes_conhecidas: []
  aposentado: []
  callers_atualizados: []
  nao_moveu:
    - components/equipment-3d-carousel.tsx
    - components/scroll-reveal-init.tsx
    - components/ui/lazy-3d-carousel.tsx
    - components/ui/model-viewer.tsx
    - components/service-worker-register.tsx
  bloqueio:
    razao: >-
      Únicos .tsx/.ts com implementação real em components/ são os quatro
      arquivos 3D/scroll-reveal (proibidos) e o ServiceWorkerRegister (host).
      Não há grupo coeso de produto (admin/client/ui) restante para fatia 309.
    proximo_passo_sugerido: >-
      Fatia dedicada e explícita para carrossel 3D + scroll-reveal (ler
      docs/features/equipment-3d-carousel.md) e/ou limpeza de pastas vazias em
      components/; não declarar migração components/ concluída enquanto esses
      arquivos existirem.
  nao_verificado:
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: comportamento visual do carrossel 3D]"
    - "[NOT_VERIFIED: registro do service worker em produção]"
```
