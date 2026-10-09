# 356-pgpass

## Resultado

- Caminho verificado: `%APPDATA%\postgresql\pgpass.conf`.
- Arquivo: **ausente**.
- Linhas locais (localhost / 127.0.0.1 / `*`): **não aplicável** (arquivo
  inexistente).
- Conexão ao Postgres: **não executada** (regra: parar sem conectar se pgpass
  não existir).
- `CREATE DATABASE gblocacoes_test`: **não executado**.
- `TEST_DATABASE_URL`: **não exportado**.
- `pnpm test`: **não executado**.
- Script temporário: **não criado**.
- Sem DROP. Sem commit. Carrossel 3D intacto. Sem CHANGELOG (sem mudança de
  código de produto).

## Bloqueio

Arquivo `pgpass.conf` ausente em `%APPDATA%\postgresql\`. Sem linha local de
credencial; parada sem tentar conexão.

## Não verificado

- `[NOT_VERIFIED: pnpm test]`
- `[NOT_VERIFIED: gblocacoes_test]`
- `[NOT_VERIFIED: cobertura]`
