# Política de slug de locadora

> **Status**: Critical **Last updated**: 2026-09-26

---

## 1. Purpose

Cada locadora é servida no próprio subdomínio (`{slug}.<raiz>`, decisão D15 em
`docs/architecture/adr-tenant-hosts.md`). O slug precisa, portanto, ser um
rótulo DNS válido e não pode colidir com os hosts nem com as rotas de primeiro
nível da plataforma. Esta página descreve como a regra é garantida em três
lugares com o mesmo conteúdo: contrato, banco e ferramenta de pré-deploy.

## 2. Scope

**In scope**

- Sintaxe do slug: 2 a 63 caracteres, `[a-z0-9-]`, sem hífen nas pontas e sem
  `--` em nenhuma posição (bloqueia `xn--` e o separador `---` do preview da
  Vercel).
- `CHECK` `organizations_slug_dns_label` no banco, com preflight que aborta sem
  alterar dados.
- Verificação de slugs reservados antes de cada deploy, somente leitura.
- Padrão de preflight de migration em tabelas com `FORCE ROW LEVEL SECURITY`.

**Out of scope**

- Criação ou renomeação de locadora (não existe fluxo no produto; mudar um slug
  ativo exige operação manual com 308, conforme D15).
- Domínios próprios (Lote 11).

## 3. Entry Points

- Contrato: `packages/contracts/src/platform.ts` (`TENANT_SLUG_RE`,
  `isTenantSlug`) e `packages/contracts/src/platform.json`
  (`reservedSubdomains`, única fonte da lista de reservados).
- Migration:
  `prisma/migrations/202609260005_organization_slug_policy/migration.sql`.
- Ferramenta: `tools/tenant-slug-preflight.mjs`, exposta como
  `pnpm tenant:slug-preflight` no `package.json` da raiz. Lê só `DATABASE_URL`
  do ambiente e não carrega `.env`.

## 4. Core Flow

Antes de cada deploy que inclua migrations:

1. Rodar a ferramenta contra o banco que vai receber o deploy:
   `DATABASE_URL=<url do banco> pnpm tenant:slug-preflight`. Ela abre uma
   transação `READ ONLY`, lê `organizations` e imprime um JSON com as
   organizações fora da política (motivos `INVALID_DNS_LABEL` e/ou `RESERVED`).
   Exit 0 sem violações; exit 1 com violações ou quando não consegue concluir.
2. Com exit 0, rodar `pnpm exec prisma migrate deploy`.
3. A migration `202609260005` repete a checagem de sintaxe (preflight) e só
   então cria o `CHECK`. Se houver slug fora da regra, ela aborta com
   `Preflight organizations_slug_dns_label: N organização(ões) fora da política (...)`
   e nada é alterado; o Prisma registra a migration como falha (P3018).
4. Depois do `CHECK`, nenhum `INSERT` ou `UPDATE` grava slug fora da sintaxe
   (erro `23514`). Os reservados continuam fora do banco: a ferramenta é a única
   checagem deles no banco.

## 5. Components and Files

- `packages/contracts/src/platform.ts` e `platform.json` (lote L0)
- `prisma/migrations/202609260005_organization_slug_policy/migration.sql`
- `tools/tenant-slug-preflight.mjs`
- `tests/unit/tenant-slug-policy.test.ts`
- `tests/unit/migration-preflight-rls.test.ts`

## 6. Data and State

- Tabela `organizations`: modelo global (`tools/tenant-models.json`), sem row
  level security. O preflight da `202609260005` confirma isso em SQL e aborta se
  a tabela tiver RLS, porque então não poderia garantir que viu todas as linhas.
- `CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$' AND position('--' in "slug") = 0)`.
  `CHECK` não é modelado pelo Prisma: `schema.prisma` não muda e
  `prisma migrate diff` não o lista.
- Nenhum serviço externo.

## 7. Constraints and Edge Cases

- A expressão regular do banco, `TENANT_SLUG_RE` e `TENANT_SLUG_PATTERN` da
  ferramenta são a mesma regra. O teste compara a fonte das duas regex e passa a
  mesma matriz pelo `CHECK` real.
- Rejeitados: `x` e `a` (1 caractere), 64 caracteres, `a--b`, `xn--abc`,
  `abc---def`, `-ab`, `ab-`, maiúsculas, `_`, `.`, espaço, acentos, caracteres
  de largura total e `ab\n`.
- Aceitos: `ab`, `1a`, `00`, `a-b`, 63 caracteres.
- Reservados válidos na sintaxe (por exemplo `admin`) passam no `CHECK` e são
  apontados só pela ferramenta. `m` e `l` são reservados e também inválidos.
- A ferramenta usa `SET LOCAL row_security = off`: se alguma política de RLS
  viesse a se aplicar ao papel usado, o PostgreSQL falha (42501) em vez de
  esconder linhas e deixar a checagem passar vazia.
- O parâmetro `?schema=` da URL do Prisma é respeitado (padrão `public`).

## 8. Error Handling

- Preflight da migration: o `prisma migrate deploy` para com P3018 (P0001) e
  registra a `202609260005` como falha; enquanto ela estiver assim, todo deploy
  seguinte é recusado com P3009, mesmo com os dados já corrigidos. A ordem é:
  1. corrija os slugs listados com aprovação (operação manual, com 308 para o
     host antigo se a locadora já estiver ativa) e registre a correção;
  2. marque a migration como revertida:
     `pnpm exec prisma migrate resolve --rolled-back 202609260005_organization_slug_policy`;
  3. só então rode `pnpm exec prisma migrate deploy`.

  A mensagem do preflight traz os mesmos dois comandos, e o mesmo vale para os
  preflights de `202609260001` a `0004`, cada um com o próprio nome.

- Ferramenta: sem `DATABASE_URL`, falha de conexão ou erro do servidor dão
  exit 1. A mensagem traz só o SQLSTATE e o texto do servidor, nunca a URL de
  conexão.

## 9. Preflights de migration sob `FORCE ROW LEVEL SECURITY`

Desde a `202609250005`, as tabelas de locadora têm `FORCE ROW LEVEL SECURITY` e
a política `tenant_isolation` compara `tenantId` com `app.tenant_id`. Durante
uma migration esse valor é vazio. Um papel de migração que é dono das tabelas
mas não é superuser nem `BYPASSRLS` via **zero** linhas, e os `SELECT count(*)`
dos preflights de `202609260001` a `0004` passavam em silêncio (achado
data-integrity#1 da revisão da onda 1).

Padrão adotado nessas migrations:

```sql
DO $$
DECLARE forced boolean; -- mais as variáveis do preflight
BEGIN
  SELECT relforcerowsecurity INTO STRICT forced FROM pg_class WHERE oid = '"rentals"'::regclass;
  IF forced THEN ALTER TABLE "rentals" NO FORCE ROW LEVEL SECURITY; END IF;
  -- contagens e RAISE EXCEPTION do preflight
  IF forced THEN ALTER TABLE "rentals" FORCE ROW LEVEL SECURITY; END IF;
END $$;
```

Por que funciona com o dono não-superuser usado em produção:

- Sem `FORCE`, o dono da tabela não é filtrado pela política e vê todas as
  linhas, inclusive as de outras locadoras e as sem locadora.
- Tudo acontece em **um único** comando `DO`, que confirma ou desfaz como uma
  unidade. Se o preflight aborta, o `NO FORCE` é desfeito junto, qualquer que
  seja o modo de execução do runner.
- `ALTER TABLE` segura `ACCESS EXCLUSIVE` até o fim da transação: nenhuma outra
  sessão enxerga a tabela sem `FORCE`. `ENABLE ROW LEVEL SECURITY` e a política
  não mudam, então papéis que não são donos (runtime) nunca são afetados.
- O estado anterior é restaurado exatamente, e a migration não muda a
  configuração de segurança.
- Um papel que não é dono falha no próprio preflight (`must be owner`), antes de
  qualquer contagem ou DDL.

Alternativas descartadas:

- `SET LOCAL row_security = off`: transforma o silêncio em erro, mas o dono sem
  `BYPASSRLS` passaria a falhar **sempre**, mesmo com dados limpos, e a
  migration não poderia ser aplicada por esse papel.
- Função `SECURITY DEFINER`: executa como o próprio dono, que continua sujeito
  ao `FORCE`. Criar um dono `BYPASSRLS` exige superuser.
- Iterar `app.tenant_id` por locadora: nunca vê as linhas com `tenantId` nulo,
  que a política esconde sempre.

Comportamento do Prisma 7.10 medido neste repositório (log `log_statement=all`
num banco descartável):

- Um script de migration que contém bloco `$$` é enviado inteiro como uma query
  simples. O PostgreSQL executa as instruções numa transação implícita, e uma
  falha desfaz a migration inteira.
- Um script sem `$$` é dividido e enviado instrução por instrução, cada uma em
  autocommit. Uma falha no meio deixa as instruções anteriores aplicadas.

Por isso o padrão não depende da transação da migration. Toda migration nova com
preflight de dados em tabela com `FORCE` deve seguir o mesmo formato e ganhar um
caso em `tests/unit/migration-preflight-rls.test.ts`.

## 10. Tests and Validation

- `tests/unit/migration-preflight-rls.test.ts`: aplica as migrations reais num
  schema temporário, como um papel dono sem superuser nem `BYPASSRLS`. Grava
  linhas inválidas sob duas locadoras e sem locadora, e prova quatro coisas:
  - cada preflight de `202609260001` a `0004` aborta com a mensagem de
    reconciliação;
  - os dados, o enum e os índices ficam iguais;
  - o `FORCE` continua ativo;
  - depois da correção, a migration aplica e o `FORCE` volta.

  Com o SQL anterior à correção, os quatro casos falham.

- `tests/unit/tenant-slug-policy.test.ts` cobre quatro pontos:
  - a igualdade das regras entre contrato, ferramenta e banco (matriz);
  - o preflight da `202609260005`, que aborta sem alterar dados;
  - o `CHECK`, que rejeita `x`, `a--b` e 64 caracteres;
  - a ferramenta: JSON, códigos de saída, somente leitura e falha em vez de
    passar vazia sob RLS.
- Testes de banco exigem `TEST_DATABASE_URL` local e
  `TEST_DATABASE_DISPOSABLE=true`; eles criam e removem papéis e schemas
  próprios.
- Manual: `DATABASE_URL=<url> pnpm tenant:slug-preflight`.
- Pendente: fixtures de outros testes que gravam slug com `_` falham com `23514`
  depois da `202609260005` (entrada 158 de `docs/issues/known-issues.md`).

## 11. Related Docs

- `docs/architecture/adr-tenant-hosts.md` (D3, D15)
- `docs/architecture/multiempresa.md`
- `docs/features/organization-selection.md`

## 12. Change Log

- 2026-09-26: script `pnpm tenant:slug-preflight` na raiz (lote gates).
- 2026-09-26: Política de slug no banco (`202609260005`), ferramenta de
  pré-deploy e padrão de preflight sob `FORCE ROW LEVEL SECURITY` nas migrations
  `202609260001` a `0004`.
