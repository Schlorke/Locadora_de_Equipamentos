# 330-remedicao-gates

Remedição dos gates após a mudança do carrossel para `widgets/hero` e a saída de
scroll-reveal/service worker para `app/`. Ordem: arch → tokens → check:tokens →
typecheck → build:web; test bloqueado (`TEST_DATABASE_URL` ausente no ambiente e
em `.env`/`.env.local`). Sem correção de import (todos os comandos da cadeia
saíram 0). Sem `bundle:mobile`. Carrossel 3D não tocado. Código de produto não
alterado nesta fatia. Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 330-remedicao-gates
  estado: intermediate
  conceito: >-
    remediar arch/tokens/check:tokens/typecheck/build:web pós-carrossel
    widgets/hero e host reveal/SW em app/; test só se TEST_DATABASE_URL já
    existir
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 329)
    - package.json (scripts arch/tokens/check:tokens/typecheck/build:web/test)
  invariantes:
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece (API + rotas finas)"
    - id: sem-inventario-test-url
      prova:
        "TEST_DATABASE_URL ausente (env + .env + .env.local); pnpm test não
        executado"
  comandos:
    - cmd: "pnpm arch"
      exit: 0
    - cmd: "pnpm tokens"
      exit: 0
    - cmd: "pnpm check:tokens"
      exit: 0
    - cmd: "pnpm typecheck"
      exit: 0
    - cmd: "pnpm build:web"
      exit: 0
    - cmd: "pnpm test"
      exit: null
      bloqueio: "TEST_DATABASE_URL ausente"
  gate:
    arch: pass
    tokens: pass
    check_tokens: pass
    typecheck: pass
    build_web: pass
    test: blocked
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção (API + rotas finas)"
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - bundle:mobile
    - correção de import (não necessária)
    - alteração de código de produto
    - apagar app/ da raiz
    - alterar lógica do carrossel 3D
  migracao_concluida: false
```
