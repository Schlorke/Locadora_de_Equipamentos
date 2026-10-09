# Identidade persistida e autorização por locadora

## Fronteiras

`packages/backend/src/modules/identity` contém a configuração/factory Better
Auth, préflight de migração, bridge temporária de credenciais e resolução de
principal. A API pública é `@gb-locacoes/backend/identity`. Next compõe Prisma e
envio de e-mail em `lib/identity.ts`; `lib/application-session.ts` adapta o
contrato legado. Nenhum cliente importa implementações do servidor.

User é identidade global. AuthSession/AuthAccount/AuthVerification/AuthRateLimit
são tabelas novas; IDs dos usuários, hashes bcrypt, contas OAuth e timestamp
legado de verificação são preservados. `authEmailVerified` é o booleano usado
pelo motor novo. Sessões persistidas são revogáveis, sem cache de sessão em
cookie. Origem e CSRF ficam explicitamente ativos, inclusive nos testes. Role
enviado pelo cadastro é ignorado; mudanças de papel pertencem ao servidor.

A autorização de recursos usa Membership ACTIVE na Organization ACTIVE, relida
em cada requisição. User.role global não autoriza recursos de locadora.
`resolveTenantPrincipal(request)` retorna um principal com userId, tenantId,
membershipId e role da membership, ou Response de erro. `x-tenant-id` e cookie
`selected-tenant-id` devem concordar: anônimo recebe 401; ausência de seleção
409; divergência/formato inválido 400; membership ausente/revogada/suspensa ou
organização suspensa 403. Não existe seleção automática da primeira organização.

`withTenantTransaction(context, operation)` configura `app.tenant_id` com
`set_config(..., true)` na mesma transação Prisma (timeout padrão 15 segundos).
RLS e chaves estrangeiras compostas complementam filtros e ownership do serviço.
O contexto nunca vem diretamente de um payload sem validação. Catálogo público
resolve somente slug de organização ACTIVE; não recebe papel administrativo.

GET `/api/auth/organizations` retorna apenas memberships ativas do usuário
logado, com `{memberships:[{tenant:{id,slug,name,status},membershipId,role}]}`.
Listar opções não seleciona uma locadora nem concede acesso futuro sem
revalidação.

## Coexistência e corte

- Default: `AUTH_MODE=legacy`, `AUTH_V2_ENABLED=false` (ou ausente). NextAuth
  permanece ativo.
- Preview explícito: `AUTH_MODE=legacy`, `AUTH_V2_ENABLED=true`. Better Auth
  atende `/api/auth/v2`; a coluna User.password continua a única origem de
  credenciais. Após validar bcrypt no login, o bridge espelha o hash atual em
  AuthAccount. Endpoints de mudança/cadastro/reset de senha V2 estão bloqueados.
- Corte: `AUTH_MODE=better-auth`. Better Auth atende `/api/auth`; `/api/auth/v2`
  retorna 410. JWT NextAuth nunca é aceito como fallback. Todos reautenticam. A
  coluna legada de senha deixa de ser escrita/lida para autenticação.

As URLs `/api/auth/register`, `/forgot-password`, `/reset-password` e
`/verify-email` mantêm os contratos públicos através de wrappers. No corte,
encaminham ao mesmo motor Better Auth e não escrevem credenciais legadas. No
modo legado, tokens agora são vinculados à finalidade e consumidos atomicamente;
tokens antigos sem finalidade devem ser reemitidos. Reset revoga sessões V2. O
link de verificação não pode servir como token de troca de senha.

`AUTH_CREDENTIAL_WRITES_PAUSED=true` pausa os writers durante backfill. O CLI
`scripts/security/identity-backfill.ts` faz préflight por padrão e só aplica com
`--apply --confirm=identity-backfill`; exige pausa e recusa execução após corte.
Mesmo inspeção remota exige `--allow-remote`. Não carrega `.env` por conta
própria. Préflight reporta contagens de emails normalizados/duplicados, hashes
não suportados e vínculos conflitantes, sem imprimir email, senha, hash ou
token. Duplicidade de email normalizado bloqueia aplicação; não mescla usuários.

```sh
node node_modules/tsx/dist/cli.mjs scripts/security/identity-backfill.ts
```

Antes de qualquer corte real: aplicar migrations revisadas, resolver conflitos
do préflight, pausar writers, executar backfill explícito, validar callbacks
OAuth e entrega de e-mail, concluir migração/quarentena dos consumidores de
sessão e recursos de tenant, depois mudar a configuração dos hosts e reiniciar
processos. Não reativar o writer antigo como rollback depois que senhas novas
forem gravadas. Não houve corte nem backfill em dados reais durante esta
implementação.

## Clientes e configuração

BETTER_AUTH_URL deve ser origem HTTP canônica (HTTPS em produção), sem path.
BETTER_AUTH_SECRET exige pelo menos 32 caracteres. AUTH_TRUSTED_ORIGINS é lista
explícita separada por vírgulas, incluindo o scheme native aprovado; sem
wildcard. Google/Facebook usam as credenciais existentes, com callbacks no
basePath ativo. O linking automático depende de identidade verificada pelo
provedor; não se adiciona um bypass para emails não verificados.

Web usa o cliente padrão Better Auth e cookies HttpOnly. Expo usa expoClient com
SecureStore; requisições de domínio enviam getCookie() em Cookie com
credentials=omit. O scheme/template mobile precisa ser definido na configuração
do host antes da distribuição. A configuração pública dos hosts deve acompanhar
o path de coexistência/corte; o backend não negocia downgrade automático.

E-mails de identidade são da plataforma global: `PLATFORM_NAME` opcional compõe
o assunto. Sem ele, os assuntos são genéricos, sem marca de uma locadora ou
seleção implícita da primeira membership.

## Evidência e limites

A suíte isolada de segurança exercita facade, rejeição de JWT após corte,
principal tenant e consumo de token por finalidade.

```sh
node node_modules/vitest/vitest.mjs run --config vitest.security.config.ts
```

A suíte exige `TEST_DATABASE_URL` PostgreSQL loopback com nome de banco de teste
e `TEST_DATABASE_DISPOSABLE=true`. O guard compartilhado rejeita o mesmo banco
de `DATABASE_URL`/`DIRECT_URL`; não fixa porta ou nome exclusivo da máquina
local. Usa Prisma e handlers reais; e-mail é mockado e fetch externo bloqueado.
As fixtures próprias são removidas ou revertidas ao final.

```sh
node node_modules/vitest/vitest.mjs run --config vitest.identity.config.ts
```

Sete testes de engine passaram: bcrypt importado, sessão persistida/cookie,
revogação, senha incorreta, origem estranha, role de cadastro, reset de uso
único e exclusão de writer paralelo. Não comprovam OAuth real, deep links no
aparelho, configuração de produção ou acesso aos endpoints legados ainda não
migrados. Uma sessão global válida sozinha não comprova isolamento de dados
multiempresa.
