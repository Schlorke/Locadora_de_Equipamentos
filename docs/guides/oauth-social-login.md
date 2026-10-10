# Login social: composição e configuração por ambiente

Google e Facebook são provedores suportados pelas portas de identidade atuais. O
[guia anterior](../archive/wave135-pre-f/docs/guides/oauth-social-login.md.source)
registra a integração da época; suas contas, telas de console e redirects não
são instruções para ativar serviços GB nesta plataforma.

## Donos atuais

- `packages/ui/src/contract/social-login-buttons.ts`: contrato do botão,
  incluindo `onSignIn(provider, callbackUrl)`, estado de carregamento e erro.
- `packages/ui/src/web/SocialLoginButtons.web.tsx` e sua variante native:
  apresentação consumida por `@gb-locacoes/ui`; não acessam banco ou segredos.
- `packages/frontend/src/pages/entrar/model/use-entrar-model.ts`: delega o
  provedor à porta `signInProvider` entregue pelo host.
- `packages/backend/src/modules/identity/legacy-auth.ts`: composição NextAuth e
  seus callbacks, mantida como motor `legacy` após a retirada da árvore antiga.
- `packages/backend/src/modules/identity/configuration.ts` e `factory.ts`:
  configuração e composição Better Auth.
- `apps/services/api/src/app/api/auth/[...nextauth]/route.ts` e
  `apps/services/api/src/app/api/auth/v2/[...all]/route.ts`: bordas HTTP dos
  motores, conforme o modo configurado.

O namespace `legacy` identifica um motor ainda suportado; não restaura a árvore
aposentada nem autoriza o host a importar detalhes servidor no frontend.

## Configurar somente o ambiente próprio

O servidor lê `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` e
`FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`. Os valores são privados e não
devem ser adicionados a Markdown, ao bundle ou a variáveis públicas. Use os
exemplos de ambiente de cada host e o
[guia de configuração](../getting-started/development.md).

As origens e URLs de retorno precisam corresponder ao app e à locadora próprios.
A configuração Better Auth recusa curingas de origem; em modo multi-host, a
origem web aceita vem da borda validada daquela requisição, não de uma lista
ampla de sites. Não copiar callbacks ou vínculos de uma conta de terceiros.

`NEXT_PUBLIC_AUTH_MODE` é uma decisão do build do cliente. Alterar apenas o modo
servidor não recompila o bundle web. Uma prova completa do login deve usar
cliente compilado e servidor configurado no mesmo cenário; confira a
[ADR de hosts](../architecture/adr-tenant-hosts.md) para cookies, origem e
identidade entre hosts.

## Prova necessária

Em ambiente autorizado, observar o clique real, o retorno do provedor, a sessão
do host de destino e o acesso permitido à locadora correta. Verificar erro e
cancelamento sem apagar limites de tentativa ou aceitar uma sessão de outro
host. A criação de identidade OAuth não concede por si só acesso administrativo
ou vínculo com qualquer organização.

Fixtures locais e testes de identidade protegem as portas, callbacks e isolações
que exercitam. Não comprovam revisão de aplicativo, consentimento, domínio ou
configuração de um provedor real. Esta revisão documental não habilita OAuth nem
cria credenciais.

_Atualizado em 2026-10-09; leitura estática da composição pós-retirada._
