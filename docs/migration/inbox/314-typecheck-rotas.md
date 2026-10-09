# 314-typecheck-rotas

Typecheck das fatias de rota do host novo (310–313). Sem commit, sem
`pnpm install`, sem Prisma migrate/push/seed, sem build/test/bundle. Sem editar
`docs/migration/MIGRATION.md` nem `CHANGELOG.md`. Sem tocar no carrossel 3D / SW
listados no escopo.

```yaml
fatia:
  id: 314-typecheck-rotas
  estado: blocked
  conceito: >-
    rodar typecheck do monorepo/hosts; se falhar, corrigir só adaptadores finos
    em apps/clients/{web,mobile}/src/app/** das fatias 310–313
  comandos:
    - cmd: pnpm typecheck
      exit: 1
      verificado_em: "2026-09-25 17:10"
      nota: >-
        script package.json "typecheck" falhou antes do tsc real: 'tsc' não
        reconhecido no PATH do shell (Windows). node_modules/.bin tem tsc.CMD
        (typescript 7.0.2), mas pnpm não o resolveu neste ambiente.
    - cmd: >-
        .\node_modules\.bin\tsc.CMD -p packages/ui/tsconfig.json && tsc -p
        packages/ui/tsconfig.native.json && tsc -p
        packages/frontend/tsconfig.json && tsc -p apps/clients/web/tsconfig.json
        && tsc -p apps/clients/mobile/tsconfig.json
      exit: 1
      verificado_em: "2026-09-25 17:10"
      nota: >-
        mesma cadeia do script typecheck, via binário local; parou no primeiro
        passo (packages/ui). hosts web/mobile não foram alcançados.
    - cmd: pnpm type-check
      exit: 1
      verificado_em: "2026-09-25 17:10"
      nota: >-
        script raiz "type-check" (patch-next-env + tsc --noEmit) também falhou
        com 'tsc' não reconhecido no PATH.
    - cmd: node tools/arch-check.mjs
      exit: nao_executado
      nota: >-
        não rodou de novo — nenhum arquivo editado nesta fatia; fatia 313 já
        tinha exit 0
    - cmd: node tools/token-check.mjs
      exit: nao_executado
      nota: >-
        não rodou de novo — nenhum arquivo editado nesta fatia; fatia 313 já
        tinha exit 0
  erros_que_ficaram:
    - arquivo: packages/ui/src/web/FilterSelectGroup.web.tsx
      mensagem: >-
        TS2307: Cannot find module '@/types/filters' or its corresponding type
        declarations.
      escopo: fora — packages/ui, não introduzido pelo adaptador do host
    - arquivo: packages/ui/src/web/FilterSelectGroup.web.tsx
      mensagem: >-
        TS7006: Parameter 'option' implicitly has an 'any' type.
      escopo: fora — packages/ui
    - arquivo: packages/ui/src/web/HoverActionMenu.web.tsx
      mensagem: >-
        TS2320: Interface 'HoverActionMenuProps' cannot simultaneously extend
        types Omit<ButtonHTMLAttributes<...>> and HoverActionMenuProps (children
        / onClick not identical).
      escopo: fora — packages/ui
  correcoes:
    - nenhuma (erros fora de apps/clients/web|mobile/src/app/**)
  arquivos_editados: []
  nao_fez:
    - corrigir packages/ui / packages/frontend / app/ da raiz
    - editar docs/migration/MIGRATION.md ou CHANGELOG.md
    - pnpm install
    - prisma migrate/push/seed
    - build / build:web / bundle:mobile
    - pnpm test
    - browser / device
    - mover carrossel 3D / model-viewer / SW
  bloqueio_restante:
    typecheck: >-
      exit 1 em packages/ui (FilterSelectGroup.web.tsx,
      HoverActionMenu.web.tsx); cadeia não chegou a apps/clients/web nem mobile
    legado_proposital:
      - 3D em components/ (equipment-3d-carousel, model-viewer, lazy-3d,
        scroll-reveal)
      - service worker no host (components/service-worker-register.tsx)
      - app/ raiz ainda é o Next de produção
      - mobile sem as páginas .web
    closeout_nao_rodado:
      - pnpm test com TEST_DATABASE_URL
      - build
      - build:web
      - bundle:mobile
      - browser
      - device
  nao_verificado:
    - "[NOT_VERIFIED: typecheck limpo nos hosts web/mobile — bloqueado em
      packages/ui]"
    - "[NOT_VERIFIED: pnpm test com TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: pnpm build]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
