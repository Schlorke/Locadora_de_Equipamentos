# 333-workspace-lock

`pnpm install` na raiz registrou os `workspace:*` de `@gb-locacoes/frontend`,
`ui` e `design-tokens` no importer `.` do lockfile. Links em
`node_modules/@gb-locacoes/*` via pnpm (`link:packages/...`). Junction
`apps/clients/web/public` → `public/` da raiz mantida. Estado intermediate.
Migração **não** concluída.

```yaml
fatia:
  id: 333-workspace-lock
  estado: intermediate
  conceito: >-
    lock raiz passa a listar workspace:* frontend/ui/design-tokens; pnpm
    install; arch e build:web; sem prisma migrate/seed; sem inventar
    TEST_DATABASE_URL; sem pnpm test
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 332)
    - docs/migration/inbox/332-dev-raiz.md
    - package.json (raiz, workspace:* já presentes)
    - pnpm-lock.yaml (importer . sem @gb-locacoes antes do install)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova:
        "app/ da raiz permanece (API + rotas finas); UI não copiada de volta"
    - id: sem-inventario-test-url
      prova: "TEST_DATABASE_URL ausente; pnpm test não executado"
    - id: alias-relativo
      prova:
        "não introduziu path absoluto C:\\ em next.config; build:web exit 0"
    - id: public-junction
      prova:
        "apps/clients/web/public junction → public/ da raiz preservada; GLB
        presente"
  alteracoes:
    - path: pnpm-lock.yaml
      nota: >-
        importer . ganhou @gb-locacoes/design-tokens, frontend, ui (specifier
        workspace:* / version link:packages/...)
    - path: node_modules/@gb-locacoes/*
      nota: "links pnpm (Junction Windows) para packages/* após install"
  comandos:
    - cmd: "pnpm install"
      exit: 0
      nota:
        "sem dependência nova no package.json; Prisma não atualizado nesta fatia"
      verificado_em: "2026-09-25"
    - cmd: "pnpm arch"
      exit: 0
      nota: "architecture gate passed (5 packages)"
    - cmd: "pnpm build:web"
      exit: 0
      nota: "Next.js 16.3.6 Turbopack; compile + TS + static pages OK"
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  gate:
    install: pass
    lock_root_workspace: pass
    arch: pass
    build_web: pass
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - dependência nova no package.json
    - atualizar Prisma
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - apagar junction apps/clients/web/public
    - path absoluto C:\\ em aliases
    - alterar lógica do carrossel 3D
    - copiar UI para app/
  migracao_concluida: false
```
