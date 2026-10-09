# 353-env-pg

## Objetivo

Inspecionar `process.env` (somente nomes) para `PGHOST`, `PGPORT`, `PGUSER`,
`PGPASSWORD`, `PGDATABASE`, `TEST_DATABASE_URL`. Se `TEST_DATABASE_URL` existir,
rodar `pnpm test`. Se não, e host local com `PGUSER`/`PGPASSWORD`, criar
`gblocacoes_test` via `pg` e testar. Caso contrário, parar sem conectar.

## Resultado

- Nomes presentes no processo: **nenhum**
- `PGHOST`: ausente (não local)
- `TEST_DATABASE_URL`: ausente
- Conexão / `CREATE DATABASE`: **não executados**
- `pnpm test`: **não executado**
- Sem leitura de `.env` / `.env.local`
- Sem uso de senha do docker-compose
- Sem migrate em `gblocacoes`
- Sem DROP
- Sem commit
- Carrossel 3D intacto

## Bloqueio

Ambiente sem variáveis PG no processo Node. Sem inventar senha.

## Não verificado

- `[NOT_VERIFIED: pnpm test]`
- `[NOT_VERIFIED: device_or_emulator]`
- `[NOT_VERIFIED: cobertura]`
