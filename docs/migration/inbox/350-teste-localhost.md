# 350-teste-localhost

Tentativa de montar `TEST_DATABASE_URL` a partir de `DATABASE_URL` em `.env` ou
`.env.local` (só em memória), criar `gblocacoes_test` no Postgres de manutenção
`postgres` se localhost, e rodar `pnpm test` com URL só no processo.

Arquivos `.env` e `.env.local` **ausentes** na raiz do repositório (apenas
`.env.example` presente). Sem `DATABASE_URL` legível → **parada imediata sem
conectar** (sem host para validar localhost). Não usou senha do
`docker-compose.yml` (recusada antes com `28P01`; não retentada). Não conectou
em `gblocacoes`. Sem `CREATE DATABASE`. Sem exportar URL. Sem `pnpm test`.
Script temporário de parse em `tools/` apagado. Sem URL nem senha neste arquivo.
Sem CHANGELOG (sem código de produto). Sem commit. Sem editar carrossel 3D.
Migração **não** concluída.

```yaml
fatia:
  id: 350-teste-localhost
  estado: intermediate
  conceito: >-
    ler DATABASE_URL de .env/.env.local em memória; se localhost, pg no database
    postgres cria gblocacoes_test se ausente; TEST_DATABASE_URL só no processo;
    pnpm test; sem URL em arquivo
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docs/migration/MIGRATION.md (final 349)
    - presença de .env / .env.local na raiz (ausentes)
    - docker-compose.yml (não usado para senha)
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: sem-apontar-test-para-gblocacoes
      prova: "não conectou teste em gblocacoes; sem DROP em gblocacoes"
    - id: sem-url-em-docs
      prova: "inbox e MIGRATION sem URL; URL não gravada em arquivo"
    - id: sem-senha-compose-retentada
      prova: "não tentou senha do docker-compose (28P01 anterior)"
    - id: script-temp-removido
      prova: "tools/_tmp_350_parse.mjs apagado; sem tools/_*.mjs"
  alteracoes: []
  comandos:
    - cmd: "checagem .env / .env.local na raiz"
      exit: 0
      resultado: ausentes (só .env.example)
      verificado_em: "2026-09-25 19:22"
    - cmd: "node tools/_tmp_350_parse.mjs"
      exit: 0
      resultado: no_env_file
      verificado_em: "2026-09-25 19:22"
    - cmd: "conexão pg / CREATE DATABASE gblocacoes_test"
      exit: null
      bloqueio: sem DATABASE_URL (.env/.env.local ausentes)
      verificado_em: "2026-09-25 19:22"
    - cmd: "pnpm test"
      exit: null
      bloqueio: >-
        sem TEST_DATABASE_URL (parada antes de conectar; sem inventar
        credenciais; sem reusar senha do compose)
      verificado_em: "2026-09-25 19:22"
  gate:
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - conectar Postgres (sem DATABASE_URL)
    - CREATE DATABASE gblocacoes_test
    - exportar TEST_DATABASE_URL
    - pnpm test
    - retentar senha docker-compose
    - usar ou DROP em gblocacoes
    - gravar URL/senha em docs
    - deixar tools/_*.mjs
    - CHANGELOG
    - commit
  migracao_concluida: false
```
