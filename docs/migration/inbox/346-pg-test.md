# 346-pg-test

Lido só `docker-compose.yml`: `POSTGRES_USER`, `POSTGRES_PASSWORD` e porta
`5432:5432` em texto (não `${VAR}`). Docker CLI / `psql` / `createdb` ausentes.
Porta `127.0.0.1:5432` alcançável.

Script Node temporário em `tools/` com pacote `pg` (já no repo): conexão no
database de manutenção `postgres` em `127.0.0.1`. Falha de autenticação Postgres
(`28P01`) na 1ª tentativa; 2ª tentativa (mesmo código) também `28P01` — não era
conexão recusada. Parou sem `CREATE DATABASE`, sem exportar URL de teste, sem
`pnpm test`. Não usou `gblocacoes` (dev). Sem `DROP`. Script temporário apagado
(sem `tools/_*.mjs` residual). Sem URL neste arquivo. Sem ler `.env` /
`.env.local`. Sem commit. Sem editar carrossel 3D. Migração **não** concluída.

```yaml
fatia:
  id: 346-pg-test
  estado: intermediate
  conceito: >-
    compose com credenciais em texto → pg cria gblocacoes_test se ausente →
    TEST_DATABASE_URL só no processo → pnpm test; auth 28P01 → bloqueio
  origem: []
  destino: []
  movido: []
  lido_antes:
    - docker-compose.yml (POSTGRES_USER/PASSWORD/DB e porta em texto)
    - docs/migration/MIGRATION.md (final 345)
  invariantes:
    - id: carrossel-3d-intacto
      prova: "não alterou Equipment3DCarousel/ModelViewer nem lógica 3D"
    - id: sem-apontar-test-para-gblocacoes
      prova: "não conectou teste em gblocacoes; sem DROP em gblocacoes"
    - id: sem-url-em-docs
      prova: "inbox e MIGRATION sem URL; URL não gravada em arquivo"
    - id: sem-ler-env-para-url
      prova: "não leu .env nem .env.local"
    - id: script-temp-removido
      prova: "tools/_346_create_test_db.mjs apagado; sem tools/_*.mjs"
  alteracoes: []
  comandos:
    - cmd: "node tools/_346_create_test_db.mjs (pg → postgres@127.0.0.1:5432)"
      exit: 1
      erro: 28P01
      nota: >-
        auth falhou; retentativa também 28P01 (não ECONNREFUSED);
        gblocacoes_test não criado; URL não exportada
      verificado_em: "2026-09-25 19:15"
    - cmd: "pnpm test"
      exit: null
      bloqueio: autenticação Postgres 28P01 com credenciais do compose
      verificado_em: "2026-09-25 19:15"
  gate:
    test: blocked
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - CREATE DATABASE gblocacoes_test (auth 28P01)
    - exportar TEST_DATABASE_URL
    - pnpm test
    - conectar ou DROP em gblocacoes
    - ler .env / .env.local
    - deixar tools/_*.mjs
    - CHANGELOG (sem mudança de código de produto)
    - commit
  migracao_concluida: false
```
