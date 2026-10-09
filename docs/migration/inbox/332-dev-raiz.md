# 332-dev-raiz

Correção da resolução workspace no `pnpm dev` da raiz: `@gb-locacoes/frontend`
passou a ser resolvido (sem Module not found). GLB `/models/Compressor.glb`
apontado no host web via junction para `public/` da raiz. Estado intermediate.
Migração **não** concluída.

```yaml
fatia:
  id: 332-dev-raiz
  estado: intermediate
  conceito: >-
    raiz pnpm.dev resolve @gb-locacoes/frontend/*; GLB no host web via public da
    raiz; sem pnpm install novo; sem inventar DATABASE_URL/TEST_DATABASE_URL
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 331)
    - package.json (raiz + packages/frontend exports)
    - next.config.mjs (raiz + apps/clients/web)
    - tsconfig.json (raiz)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece; UI não copiada de volta"
    - id: sem-inventario-test-url
      prova:
        "TEST_DATABASE_URL/DATABASE_URL não inventadas; pnpm test não executado"
  alteracoes:
    - path: package.json
      nota: "dependencies workspace:* @gb-locacoes/frontend, ui, design-tokens"
    - path: next.config.mjs
      nota: >-
        transpilePackages já existia; resolveAlias relativo + webpack alias
        (caminho absoluto Windows rejeitado pelo Turbopack)
    - path: tsconfig.json
      nota: "paths para ./app, ./pages/*, ui, design-tokens"
    - path: apps/clients/web/public
      nota: "junction local → ../../../public (Compressor.glb existe na raiz)"
    - path: .gitignore
      nota: "apps/clients/web/public (junction não versionada)"
  comandos:
    - cmd: "pnpm dev -- --port 3001"
      exit: 0
      nota: >-
        Ready; GET / sem Module not found @gb-locacoes/frontend; 500 por
        DATABASE_URL is not set (runtime env, fora do escopo); processo
        encerrado ao final
      verificado_em: "2026-09-25"
    - cmd: "HEAD http://localhost:3000/models/Compressor.glb"
      exit: 0
      nota: "200 Content-Length 997368 após junction no host web"
    - cmd: "HEAD http://localhost:3001/models/Compressor.glb"
      exit: 0
      nota: "200 na raiz (public/ já servia)"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      nota: "architecture gate passed (5 packages)"
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  browser:
    host_raiz_pnpm_dev:
      url: "http://localhost:3001"
      modulo_frontend: "resolvido (sem Module not found)"
      home_http: 500
      home_erro: "DATABASE_URL is not set (lib/prisma.ts) — não inventada"
    host_web_glb:
      url: "http://localhost:3000/models/Compressor.glb"
      http: 200
  gate:
    resolucao_workspace_raiz: pass
    glb_host_web: pass
    arch: pass
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: pnpm install — lock raiz ainda sem importer workspace;
      junctions manuais]"
    - "[NOT_VERIFIED: home 200 com DATABASE_URL real]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - inventar DATABASE_URL
    - pnpm test
    - fabricar arquivo GLB
    - segundo pacote frontend
    - copiar UI para app/
    - alterar lógica do carrossel 3D
  migracao_concluida: false
```
