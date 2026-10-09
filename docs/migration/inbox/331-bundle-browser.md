# 331-bundle-browser

Prova de `pnpm bundle:mobile` no código atual (pós-carrossel em `widgets/hero`)
e checagem browser na home e `/sobre`. Bundle exit 0 sem correção de import.
Browser no host `@gb-locacoes/web` (raiz `pnpm dev` sobe mas falha resolução de
`@gb-locacoes/frontend/*`). Páginas renderizam; sem `Module not found` do
carrossel — runtime 404 de `/models/Compressor.glb` e next-auth session. Sem
emulador. Código não alterado. Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 331-bundle-browser
  estado: intermediate
  conceito: >-
    provar bundle:mobile pós-carrossel widgets/hero; browser home+/sobre no host
    web; device se existir; sem inventar TEST_DATABASE_URL/DATABASE_URL
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 330)
    - package.json (scripts bundle:mobile / dev)
    - apps/clients/web/package.json (script dev)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece"
    - id: sem-inventario-test-url
      prova: "TEST_DATABASE_URL não inventada; pnpm test não executado"
  comandos:
    - cmd: "pnpm bundle:mobile"
      exit: 0
      nota: >-
        expo export android+ios → dist-export; iOS 1209 módulos, Android 2354;
        sem falha de import do carrossel no native; correção de import não
        necessária; sem segunda rodada de bundle
      verificado_em: "2026-09-25"
    - cmd: "pnpm arch / tokens / check:tokens / typecheck / build:web"
      exit: 0
      nota: "já medidos na fatia 330; não reexecutados aqui"
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  browser:
    host_raiz_pnpm_dev:
      status: Ready em :3000
      pagina: falha Module not found @gb-locacoes/frontend/app e pages/home
      acao: processo encerrado; trocado para host web
    host_web:
      cmd: "pnpm --filter @gb-locacoes/web dev"
      url: "http://localhost:3000"
      home:
        http: 200
        render:
          "GB Locações; H1 Locação de Equipamentos; controles Modelo
          anterior/próximo"
        modulo_carrossel:
          "sem Module not found; stack aponta widgets/hero/*.web.tsx"
        console_relevante:
          - "Compressor.glb 404 (asset ausente no host web)"
          - "next-auth CLIENT_FETCH_ERROR (/api/auth/session 404)"
          - "THREE.Clock deprecated"
      sobre:
        render: "H1 Sobre a GB Locações; conteúdo história/valores"
        modulo_carrossel: "sem Module not found; GLB 404 no carrossel da página"
  gate:
    bundle_mobile: pass
    browser_home_sobre: pass_com_runtime_nao_modulo
    test: blocked
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next legado (API + rotas finas)"
      - "pnpm dev raiz não resolve @gb-locacoes/frontend/* neste ambiente"
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: cobertura]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: asset /models/Compressor.glb no host web]"
    - "[NOT_VERIFIED: /api/auth/session no host web]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - inventar DATABASE_URL
    - pnpm test
    - correção de import (não necessária — bundle 0)
    - alteração de código de produto
    - CHANGELOG (sem mudança de código)
    - apagar app/ da raiz
    - alterar lógica do carrossel 3D
  migracao_concluida: false
```
