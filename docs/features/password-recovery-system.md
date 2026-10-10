# Recuperacao de Senha - Fluxo

> Status: Implementado Ultima atualizacao: 2026-09-26

## Objetivo

Permitir que usuarios redefinam a senha via email com token temporario, sem
expor se o email existe no sistema.

## Paginas

- `/recuperar-senha`: solicita o envio do link de recuperacao.
- `/reset-password`: define uma nova senha usando o token.

As páginas são variantes de `packages/frontend/src/pages/recuperar-senha` e
`pages/reset-password`, com modelos de transporte comuns. Os wrappers do host
web ficam em `apps/clients/web/src/app/(auth)` e em
`(public)/[locadora]/(auth)`; o host repassa um único token de query à tela, sem
copiar senha, segredo ou cliente Prisma para o navegador.

## Endpoints

Os adapters atuais ficam em `apps/services/api/src/app/api/auth` e compõem
`host/credential-accounts.ts`. Guard de mesma origem vem antes do fluxo;
`AUTH_CREDENTIAL_WRITES_PAUSED="true"` responde 503 nos dois endpoints. Casos de
credencial pertencem a backend/identity e o adapter HTTP comum a
`packages/backend/src/http/credential-accounts.ts`.

`AUTH_MODE` escolhe o motor no servidor; `NEXT_PUBLIC_AUTH_MODE` precisa
corresponder no cliente compilado. Better Auth não usa sessão legacy como
fallback. Não trocar apenas variável de runtime para certificar outro bundle.

### POST `/api/auth/forgot-password`

**Body**

```json
{
  "email": "usuario@dominio.com"
}
```

**Comportamento** (modo `AUTH_MODE=legacy`; em `better-auth` o pedido vai para
`auth.api.requestPasswordReset`)

- Retorna **200** com a mesma mensagem neutra para conta existente ou não
  (anti-enumeração). Busca, emissão do link e envio rodam depois da resposta
  (`after()`), então forma e tempo da resposta não dependem da conta.
- Origem conferida antes de tudo (onda 5): `rejectCrossOriginMutation` recusa
  com **403** um pedido de navegador vindo de outra origem, como o script de
  outra locadora (entrada 196 de `docs/issues/known-issues.md`). O mesmo vale
  para `POST /api/auth/reset-password`.
- Limite antes da busca (`refuseAuthAttempt`, composto por
  `apps/services/api/src/host/session.ts` sobre
  `packages/backend/src/modules/identity/rate-limit.ts`), nos dois modos desde a
  onda 5: 5 pedidos por IP e 3 por (conta, IP) a cada 15 min, com **429**
  `no-store` e `Retry-After`. Limitador que não consegue contar (banco fora ou
  produção sem `PLATFORM_RATE_LIMIT_SECRET`) responde **503** com `Retry-After`,
  e a causa vai para o log `[auth-rate-limit]`, sem e-mail nem IP. Por conta, no
  máximo 3 e-mails a cada 15 min, sem erro visível: o último link enviado
  continua valendo.
- A conta é localizada por e-mail exato normalizado (`findAccountsByEmail`); `%`
  e `_` não são curingas. Contas que diferem só pela caixa são ambíguas e não
  recebem link.
- Gera token de 32 bytes (base64url) com expiração de 1 hora; o banco guarda só
  o SHA-256 dele e os links anteriores da conta são apagados.
- Envia email se o Resend e `FROM_EMAIL` estiverem configurados.

### POST `/api/auth/reset-password`

**Body**

```json
{
  "token": "[TOKEN_DO_LINK]",
  "password": "[NOVA_SENHA]"
}
```

**Comportamento legacy** (`createCredentialAccounts` em
`packages/backend/src/modules/identity/credential-accounts.ts`)

- Busca o token pelo SHA-256 do valor recebido e valida o prefixo
  `password-reset:` e a expiração (400 `Token inválido ou expirado`).
- Numa transação: consome o token (uso único), apaga todos os outros links de
  recuperação da conta e atualiza a senha (bcrypt, custo 12). A troca muda a
  versão de credencial e invalida os JWTs legados emitidos antes.
- Depois da troca, as janelas de limite de login da conta recomeçam.

## Token de Recuperacao

Persistência descrita abaixo é do motor legacy. Better Auth recebe o token pelo
seu `auth.api.resetPassword`, com a tabela/configuração do próprio motor; não
consultar a tabela legacy para contornar uma recusa dele.

- Tabela: `verificationtokens`
- Campos: `identifier` (`password-reset:<email>`), `token` (SHA-256 do valor do
  link), `expires`
- Expiracao: 1 hora
- Links emitidos antes da mudança para hash (token em texto claro) deixaram de
  valer de propósito.

## Email

- Subject: `Recuperação de senha - <PLATFORM.displayName>`, nos dois modos, por
  `identitySubject` de `packages/backend/src/modules/identity/runtime.ts` (onda
  4; `PLATFORM_NAME` não é mais lida). O e-mail de identidade é da plataforma,
  nunca de uma locadora.
- Link no modo legacy: `${NEXTAUTH_URL}/reset-password?token=...` (sem
  `NEXTAUTH_URL`, a origem da requisição; escapado com `escapeEmailHtml`)
- Remetente: `FROM_EMAIL`

### Modo better-auth (identidade multi-host, onda 3)

- O link atual é da página frontend `/reset-password?token=...`. A função
  `accountLinkOrigin`, em backend/identity/factory, só usa a origem da locadora
  para cliente exclusivo dela; nos demais casos usa a origem canônica do app.
  Borda/origem e vínculo são conferidos: receber uma requisição de outro host
  não autoriza levar o link de uma conta da plataforma para lá. O
  `GET /api/auth/reset-password/:token` era o formato anterior do motor.
- Histórico da onda 4 (entrada 180): o adapter antigo
  `app/api/auth/forgot-password/route.ts` passou a enviar `request` e
  `redirectTo` relativo. A chamada atual fica em
  `createCredentialAccounts.requestPasswordReset`, composta por
  `apps/services/api/src/host/credential-accounts.ts`; a origem final segue
  `accountLinkOrigin` acima. Os wrappers web da plataforma e da locadora
  repassam o `?token=` ao ResetPasswordPage; token repetido conta como ausente.
- No host de locadora, a API de conta liberada é mínima: `forgot-password` e
  `reset-password` passam; troca de senha e sessões ficam só no host `app`
  (entrada 189).
- Onda 5: no modo better-auth, o pedido conta a tentativa na mesma janela do
  legacy antes de chamar `auth.api.requestPasswordReset` (a chamada direta não
  passa pelo limitador do Better Auth).
- `auth.api.resetPassword` recebe token/newPassword e headers; o motor confirma
  a troca antes de retornar sucesso. A configuração em backend/identity/factory
  conserva bcrypt custo 12 e `revokeSessionsOnPasswordReset: true`.
- No host `app`, as telas `/recuperar-senha` e `/reset-password` usam a casca da
  plataforma (`shell="platform"`); no host de locadora continuam na vitrine
  (`docs/features/tenant-hosts-web.md`).

## Validacoes de UI

- Senha minima: 6 caracteres
- Confirmacao obrigatoria e deve coincidir
- Erros exibidos no formulario
- Sucesso exibe CTA para login

## OAuth

- Usuarios criados via OAuth podem definir senha local usando o fluxo de
  recuperacao (se o email existir).

## Como Validar

1. Acesse `/recuperar-senha` e informe um email existente.
2. Abra o email recebido e clique no link de redefinicao.
3. Defina a nova senha e conclua.
4. Faca login com a nova senha.

Automatizado: `pnpm test:security` e `pnpm test:identity` (banco descartável com
`TEST_DATABASE_URL` e `TEST_DATABASE_DISPOSABLE=true`).

## Arquivos Relacionados

- `apps/clients/web/src/app/(auth)/recuperar-senha/page.tsx` e
  `reset-password/page.tsx`; equivalentes da locadora em
  `apps/clients/web/src/app/(public)/[locadora]/(auth)`.
- `packages/frontend/src/pages/recuperar-senha/model/use-recovery.ts` e
  `pages/reset-password/model/use-reset-password.ts`: transporte pelo HttpClient
  do produto e validações de UI; variantes .web/.native nas slices.
- `apps/services/api/src/app/api/auth/forgot-password/route.ts` e
  `reset-password/route.ts`: guarda de origem e pausa de credenciais.
- `apps/services/api/src/host/credential-accounts.ts` e `host/session.ts`:
  composição de Next after, runtime de banco/mail e limitadores persistentes.
- `packages/backend/src/modules/identity/credential-accounts.ts`,
  `legacy-credentials.ts`, `rate-limit.ts`, `runtime.ts` e `factory.ts`: conta
  exata, token legacy/engine, limites, assunto e origem.
- `packages/backend/src/http/credential-accounts.ts` e
  `packages/contracts/src/credentials.ts`: resposta HTTP e schemas.
- `prisma/schema.prisma`; problemas conhecidos: entrada 154 e ondas específicas
  registradas abaixo.

`runtime/owner-password.ts` é a verificação HIBP do novo onboarding de
proprietário; não substitui esses casos de recuperação nem autoriza executar
serviço externo na validação local do fluxo.

## Historico

- 2026-09-26 (commit `0cff7b65`): token com hash, links anteriores apagados,
  assunto pela `PLATFORM_NAME`, limite por conta e IP.
- 2026-09-26 (onda 2, commit `da19f601`): e-mail exato, limite só por
  requisitante, teto silencioso de 3 e-mails por conta e envio com `after()`.
- 2026-09-26 (onda 3, commit `be859915`): limites gravados em
  `platform_rate_limits` (entrada 176); `bcrypt.hash` assíncrono (custo 12) na
  redefinição legacy, em vez de `hashSync`; link do modo better-auth na origem
  do host.
- 2026-09-26 (onda 4, commit `4b02f52f`): `request` e `redirectTo` relativo no
  modo better-auth, `?token=` repassado pelas páginas do host web, assunto por
  `PLATFORM.displayName` e `PLATFORM_RATE_LIMIT_SECRET` obrigatória em produção.
- 2026-09-29 (onda 5, sem commit): guard de mesma origem em `forgot-password` e
  `reset-password`, limite também no modo better-auth (429 com janela gasta, 503
  sem contar), segredo pelo critério da plataforma e casca da plataforma no host
  `app` (entradas 191 e 196).
