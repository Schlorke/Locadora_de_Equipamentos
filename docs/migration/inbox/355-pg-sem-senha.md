# 355-pg-sem-senha

## Resultado

- Tentativa única: `127.0.0.1:5432`, usuário `postgres`, senha vazia
  (`password: ''`), database de manutenção `postgres`.
- Database `gblocacoes` **não** usado.
- Conexão: **falhou**.
- Código/erro observado: falha no handshake SASL/SCRAM
  (`client password must be a string`) — autenticação exige credencial; não é
  trust/senha vazia.
- Não houve retentativa com outra senha.
- `CREATE DATABASE gblocacoes_test`: **não executado**.
- `TEST_DATABASE_URL`: **não exportado**.
- `pnpm test`: **não executado**.
- Script temporário: criado e **apagado**.
- Sem DROP em qualquer database.
- Sem commit. Carrossel 3D intacto. Sem CHANGELOG (sem mudança de código de
  produto).

## Bloqueio

Postgres local em `127.0.0.1:5432` rejeita autenticação com senha vazia (SCRAM).
Parada pela regra da fatia: não inventar/tentar outra senha.

## Não verificado

- `[NOT_VERIFIED: pnpm test]`
- `[NOT_VERIFIED: gblocacoes_test]`
- `[NOT_VERIFIED: cobertura]`
