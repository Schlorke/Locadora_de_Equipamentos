# 343-pnpm-test

Tentativa de preparar Postgres local de teste via `docker-compose.yml` e rodar
`pnpm test` com `TEST_DATABASE_URL` exportada só no processo (database novo
`gblocacoes_test`, sem apontar para `gblocacoes` de desenvolvimento).

`docker-compose.yml` serviço `db`: imagem `postgres:15`, porta `5432`, usuário
local de compose, `POSTGRES_DB=gblocacoes` (dev). Compose é Postgres local no
papel; porém o CLI `docker` / `docker compose` **não** está disponível neste
ambiente (`docker` não reconhecido no PATH; `C:\Program Files\Docker` ausente;
WSL sem distribuição). Sem Docker, não subiu o serviço, não criou
`gblocacoes_test`, não montou URL, não rodou `pnpm test`, não rodou
`pnpm tokens`. Não inventou URL. Não usou `DATABASE_URL` de produção. Não
migrate/seed em `gblocacoes`. Sem commit. Sem editar carrossel 3D. Migração
**não** concluída.

```yaml
fatia:
  id: 343-pnpm-test
  estado: intermediate
  conceito: >-
    criar gblocacoes_test no Postgres do compose local, exportar
    TEST_DATABASE_URL só no processo, rodar pnpm test; se Docker indisponível,
    parar sem inventar URL
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docker-compose.yml
    - package.json (scripts test / tokens)
    - docs/migration/MIGRATION.md (final 342)
    - docs/migration/inbox/334-pnpm-test.md
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: sem-apontar-test-para-gblocacoes
      prova: "não exportou TEST_DATABASE_URL para gblocacoes; teste não rodou"
    - id: sem-inventario-url
      prova:
        "URL não inventada; não gravada em arquivo versionado nem no diário"
    - id: sem-migrate-seed-dev
      prova: "não rodou migrate/seed em gblocacoes"
  alteracoes: []
  comandos:
    - cmd: "docker compose ps / docker info"
      exit: non-zero
      bloqueio: >-
        docker não reconhecido como comando; instalação Docker Desktop /
        binários não encontrados neste host
      verificado_em: "2026-09-25 19:09"
    - cmd: "pnpm test"
      exit: null
      bloqueio: >-
        Docker indisponível; sem CREATE DATABASE gblocacoes_test;
        TEST_DATABASE_URL não montada (sem inventar)
      verificado_em: "2026-09-25 19:09"
    - cmd: "pnpm tokens"
      exit: null
      bloqueio: "pnpm test não passou (não executado); tokens não rodado"
      verificado_em: "2026-09-25 19:09"
  gate:
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — Docker indisponível]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - inventar TEST_DATABASE_URL / host / senha
    - apontar TEST_DATABASE_URL para gblocacoes
    - usar DATABASE_URL de produção
    - DROP / migrate / seed em gblocacoes
    - gravar URL em arquivo versionado ou diário
    - pnpm test
    - pnpm tokens
    - alterar código de produção ou carrossel 3D
    - commit
  migracao_concluida: false
```
