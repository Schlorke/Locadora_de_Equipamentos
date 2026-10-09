# Recuperacao de Senha - Fluxo

> Status: Implementado Ultima atualizacao: 2026-09-26

## Objetivo

Permitir que usuarios redefinam a senha via email com token temporario, sem
expor se o email existe no sistema.

## Paginas

- `/recuperar-senha`: solicita o envio do link de recuperacao.
- `/reset-password`: define uma nova senha usando o token.

## Endpoints

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
- Limite antes da busca (`lib/rate-limit.ts`, `refuseAuthAttempt`), nos dois
  modos desde a onda 5: 5 pedidos por IP e 3 por (conta, IP) a cada 15 min, com
  **429** `no-store` e `Retry-After`. Limitador que não consegue contar (banco
  fora ou produção sem `PLATFORM_RATE_LIMIT_SECRET`) responde **503** com
  `Retry-After`, e a causa vai para o log `[auth-rate-limit]`, sem e-mail nem
  IP. Por conta, no máximo 3 e-mails a cada 15 min, sem erro visível: o último
  link enviado continua valendo.
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
  "token": "uuid",
  "password": "novaSenha"
}
```

**Comportamento**

- Busca o token pelo SHA-256 do valor recebido e valida o prefixo
  `password-reset:` e a expiração (400 `Token inválido ou expirado`).
- Numa transação: consome o token (uso único), apaga todos os outros links de
  recuperação da conta e atualiza a senha (bcrypt, custo 12). A troca muda a
  versão de credencial e invalida os JWTs legados emitidos antes.
- Depois da troca, as janelas de limite de login da conta recomeçam.

## Token de Recuperacao

- Tabela: `verificationtokens`
- Campos: `identifier` (`password-reset:<email>`), `token` (SHA-256 do valor do
  link), `expires`
- Expiracao: 1 hora
- Links emitidos antes da mudança para hash (token em texto claro) deixaram de
  valer de propósito.

## Email

- Subject: `Recuperação de senha - <PLATFORM.displayName>`, nos dois modos, por
  `identitySubject` de `lib/identity.ts` (onda 4; `PLATFORM_NAME` não é mais
  lida). O e-mail de identidade é da plataforma, nunca de uma locadora.
- Link no modo legacy: `${NEXTAUTH_URL}/reset-password?token=...` (sem
  `NEXTAUTH_URL`, a origem da requisição; escapado com `escapeEmailHtml`)
- Remetente: `FROM_EMAIL`

### Modo better-auth (identidade multi-host, onda 3)

- O link passa a ser `<origem do host>/reset-password?token=...`, a página do
  frontend, no host de onde veio o pedido (antes era o
  `GET /api/auth/reset-password/:token` do Better Auth).
- Onda 4 (entrada 180 de `docs/issues/known-issues.md`):
  `app/api/auth/forgot-password/route.ts` chama `auth.api.requestPasswordReset`
  com `request` e `redirectTo` relativo (`/reset-password`), então o link sai na
  origem do host do pedido; as duas páginas `reset-password` do host web
  repassam o `?token=` ao `ResetPasswordPage` (token repetido conta como
  ausente).
- No host de locadora, a API de conta liberada é mínima: `forgot-password` e
  `reset-password` passam; troca de senha e sessões ficam só no host `app`
  (entrada 189).
- Onda 5: no modo better-auth, o pedido conta a tentativa na mesma janela do
  legacy antes de chamar `auth.api.requestPasswordReset` (a chamada direta não
  passa pelo limitador do Better Auth).
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

- `app/recuperar-senha/page.tsx`
- `app/reset-password/page.tsx`
- `app/api/auth/forgot-password/route.ts`
- `app/api/auth/reset-password/route.ts`
- `lib/auth.ts` (`findAccountsByEmail`, invólucro de `findLegacyAccountsByEmail`
  em `packages/backend/src/modules/identity/legacy-credentials.ts`),
  `lib/rate-limit.ts`, `lib/identity.ts` (`identitySubject`)
- `prisma/schema.prisma`
- Problemas conhecidos: entrada 154 de `docs/issues/known-issues.md`

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
