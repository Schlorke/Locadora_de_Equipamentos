# 344-tokens-e-teste

`pnpm tokens` (script `node tools/token-check.mjs`) rodou sem banco. Exit **1**:
1 violação — literal `#9ca3af` em
`packages/frontend/src/shared/lib/category-helpers.native.tsx` (linha ~61). 692
arquivos de código examinados; 293 test/fixture ignorados.

Porta `127.0.0.1:5432`: **aberta** (`Test-NetConnection` TcpTestSucceeded).
Compose (`docker-compose.yml` serviço `db`): host implícito local via
`5432:5432`, usuário `postgres`, `POSTGRES_DB=gblocacoes` (dev). Senha em texto
no compose; não lido `.env`.

`psql` e `createdb` **ausentes** no PATH → parou a parte de teste sem criar
`gblocacoes_test`, sem exportar URL de teste, sem `pnpm test`. Não inventou URL.
Não usou database `gblocacoes` para teste. Não leu `.env`. Docker CLI ausente
(não tentou instalar). Sem commit. Sem editar carrossel 3D. Migração **não**
concluída.

```yaml
fatia:
  id: 344-tokens-e-teste
  estado: intermediate
  conceito: >-
    pnpm tokens; se 5432 aberta e psql/createdb no PATH, criar só
    gblocacoes_test e rodar pnpm test com URL só no processo; senão parar teste
    sem inventar URL
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docker-compose.yml (host/porta/usuário/POSTGRES_DB)
    - package.json (script tokens)
    - docs/migration/MIGRATION.md (final 343)
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: sem-apontar-test-para-gblocacoes
      prova: "não usou gblocacoes como TEST; teste não rodou"
    - id: sem-url-em-docs
      prova: "inbox e MIGRATION sem URL; URL não gravada em arquivo versionado"
    - id: sem-ler-env-para-url
      prova: "não leu .env para montar URL de teste"
  alteracoes: []
  comandos:
    - cmd: "pnpm tokens"
      exit: 1
      nota: >-
        1 token violation — category-helpers.native.tsx ~61 #9ca3af; examined
        692 code files
      verificado_em: "2026-09-25 19:11"
    - cmd: "Test-NetConnection 127.0.0.1:5432"
      exit: 0
      TcpTestSucceeded: true
      verificado_em: "2026-09-25 19:11"
    - cmd: "Get-Command psql / createdb"
      exit: 0
      resultado: ausentes no PATH
      verificado_em: "2026-09-25 19:11"
    - cmd: "pnpm test"
      exit: null
      bloqueio: >-
        porta 5432 aberta mas sem psql/createdb; parte de teste parada sem
        inventar URL
      verificado_em: "2026-09-25 19:11"
  gate:
    tokens: failed
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - criar gblocacoes_test (sem cliente psql/createdb)
    - exportar URL de teste
    - pnpm test
    - ler .env para montar URL
    - apontar teste para gblocacoes
    - inventar URL de produção
    - instalar Docker
    - alterar código ou carrossel 3D
    - CHANGELOG (sem mudança de código)
    - commit
  migracao_concluida: false
```
