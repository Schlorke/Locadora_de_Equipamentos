# 334-pnpm-test

Avaliação de `pnpm test` com Postgres local já documentado no repo. Variável
exigida pelo harness: `TEST_DATABASE_URL` (`tests/global-setup.ts` /
`vitest.config.ts`). `.env.example` usa placeholder genérico (host/database),
não `localhost`/`127.0.0.1` com nome de database claramente de teste.
`docker-compose.yml` serviço `db` cria `POSTGRES_DB=gblocacoes` (banco da
aplicação/dev), não um database de teste. CI (`test_db`) não é o compose local.
Sem `.env` / `.env.local` / env de processo com `TEST_DATABASE_URL`. Não
inventou URL, não reutilizou `DATABASE_URL` de desenvolvimento, não subiu
compose como banco de teste, não rodou migrate/seed. `pnpm test` não executado.
Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 334-pnpm-test
  estado: intermediate
  conceito: >-
    rodar pnpm test só com TEST_DATABASE_URL local de teste já documentada; se
    ausente, bloquear sem inventar host/senha nem apontar para produção
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/MIGRATION.md (final 333)
    - docker-compose.yml
    - .env.example
    - tests/global-setup.ts
    - vitest.config.ts
    - docs/guides/testing.md
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: sem-apagar-app
      prova:
        "app/ da raiz permanece (API + rotas finas); UI não copiada de volta"
    - id: sem-inventario-test-url
      prova:
        "TEST_DATABASE_URL ausente (processo + .env + .env.local); exemplo sem
        localhost/test-named DB; compose db=gblocacoes (dev)"
    - id: sem-usar-db-dev-como-teste
      prova:
        "não apontou TEST_DATABASE_URL para gblocacoes nem para DATABASE_URL de
        desenvolvimento"
  alteracoes: []
  comandos:
    - cmd: "pnpm test"
      exit: null
      bloqueio: >-
        TEST_DATABASE_URL ausente; .env.example é placeholder genérico;
        docker-compose POSTGRES_DB=gblocacoes (dev, não teste); sem URL local de
        teste documentada para exportar
      verificado_em: "2026-09-25"
  gate:
    test: blocked
    arch: pass
    build_web: pass
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL local de teste]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - inventar TEST_DATABASE_URL / host / senha
    - usar DATABASE_URL de desenvolvimento como TEST_DATABASE_URL
    - docker compose up apontando gblocacoes como banco de teste
    - prisma migrate/seed
    - alterar código de produção ou carrossel 3D
    - pnpm test
  migracao_concluida: false
```
