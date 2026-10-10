# Manifesto de variáveis do corte (API, web e fallback-raiz)

Estado em 2026-10-08, onda 135, Lote C (C2). Referência para configurar os
projetos do corte de produção descrito em
[runbook do corte](runbook-corte-raiz-legada.md). Este documento não guarda
valor real: segredos ficam só nas variáveis de cada projeto
([diretrizes](../internal/documentation-security-guidelines.md)). `<raiz>` é o
domínio da plataforma (D1) e `<origem-api>` é a origem pública da API (D5).

Cada tabela é conferida pelo teste `tests/unit/env-manifest.test.ts`: ele segue
os imports a partir das entradas do projeto (o mesmo resolvedor do `pnpm arch`)
e reprova variável lida pelo código que falte aqui, e linha daqui que nenhum
código do projeto leia. O `.env.example` da API e o do web listam exatamente as
linhas "Sim" e "Opcional" das suas tabelas.

A tag de pré-exclusão foi publicada em 2026-10-09 e aponta para
`978ceb9244c81c7cb2888b798fad8ce90edad25e`. A conferência do fallback usa
exclusivamente os blobs dessa referência, após a retirada da antiga app/ e lib/
no clone F. Antes da tag, a conferência usava a raiz presente e registrava o
estado pré-tag; esse resultado antigo não comprova o artefato imutável atual.
Tag ausente ou incompleta impede a conferência. Configuração hospedada, banco
real, provedores e operação continuam posteriores à preparação local.

Coluna "Configurar":

- **Sim**: obrigatória no corte;
- **Opcional**: configurar só se a função for usada; o padrão está nas notas;
- **Não**: o código compartilhado a lê, mas ela não pertence a este projeto
  (deixar ausente);
- **Automática**: a plataforma (Vercel ou Next.js) define.

Decisão D3 (2026-10-08): o corte usa Better Auth. `AUTH_MODE` da API e do
fallback-raiz e `NEXT_PUBLIC_AUTH_MODE` do web valem `better-auth`, mudam juntos
e o web precisa de rebuild a cada troca.

## Projeto API (`apps/services/api`)

Projeto Vercel com Root Directory `apps/services/api` (ou a imagem de
`apps/services/api/Dockerfile`, na D6). Domínio da origem pública da API (D5).
Os webhooks, o mobile, o agendador e o proxy do web chamam esta origem.

<!-- manifesto:api -->

| Variável                                            | Configurar | Valor no corte                                                                 | Notas                                                                                                                              |
| --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                      | Sim        | Papel de runtime de negócio                                                    | Sem ownership, SUPERUSER ou BYPASSRLS (`pnpm tenant:check`). Pool de 1 a 2 conexões por processo (C9).                             |
| `PLATFORM_DATABASE_URL`                             | Sim        | Papel `platform_runtime`                                                       | Nunca usa `DATABASE_URL` como reserva. Ausente: `/api/cron/platform` e o cadastro de locadora respondem 503.                       |
| `PLATFORM_ENV`                                      | Sim        | `production`                                                                   | Produção exige https e proíbe labs.                                                                                                |
| `PLATFORM_ROOT_DOMAIN`                              | Sim        | `<raiz>`                                                                       | Sem esquema, porta ou caminho.                                                                                                     |
| `PLATFORM_EDGE_SECRET`                              | Sim        | Mesmo valor do web                                                             | 32 caracteres ou mais. Assina o contexto de borda do proxy.                                                                        |
| `PLATFORM_EDGE_SECRET_PREVIOUS`                     | Opcional   | Valor anterior durante a rotação                                               | Mesmo valor do web.                                                                                                                |
| `PLATFORM_RATE_LIMIT_SECRET`                        | Sim        | Segredo do ambiente                                                            | 32 caracteres ou mais, igual em todas as instâncias e no fallback-raiz.                                                            |
| `TRUSTED_PROXY_HOPS`                                | Opcional   | Vazia na Vercel                                                                | Só fora da Vercel, com o número real de proxies na frente do `next start`.                                                         |
| `WEB_PUBLIC_ORIGIN`                                 | Opcional   | Vazia                                                                          | Origem esperada de mutações que chegam sem borda validada; com a borda, vale a origem do host.                                     |
| `AUTH_MODE`                                         | Sim        | `better-auth` (D3)                                                             | Igual ao `NEXT_PUBLIC_AUTH_MODE` do web.                                                                                           |
| `AUTH_V2_ENABLED`                                   | Opcional   | Vazia                                                                          | Só no modo `legacy` (Better Auth ao lado do NextAuth).                                                                             |
| `AUTH_CREDENTIAL_WRITES_PAUSED`                     | Opcional   | `false`                                                                        | `true` pausa cadastro, senha e verificação de e-mail (útil na janela do corte).                                                    |
| `BETTER_AUTH_URL`                                   | Sim        | `https://app.<raiz>`                                                           | Validada como a origem `app` em produção.                                                                                          |
| `BETTER_AUTH_SECRET`                                | Sim        | Segredo do ambiente                                                            | 32 caracteres ou mais; o mesmo no fallback-raiz.                                                                                   |
| `AUTH_TRUSTED_ORIGINS`                              | Opcional   | Scheme do app (`platform.json`)                                                | Só para o app nativo; curinga é proibido.                                                                                          |
| `BETTER_AUTH_TRUSTED_ORIGINS`                       | Não        | Ausente                                                                        | Recusada pela configuração (o Better Auth a somaria a toda requisição).                                                            |
| `NEXTAUTH_URL`                                      | Sim        | `https://app.<raiz>`                                                           | Links de e-mail e callback do modo legado; redirect do Zoho quando `ZOHO_REDIRECT_URI` falta.                                      |
| `NEXTAUTH_SECRET`                                   | Sim        | Segredo da produção atual                                                      | Lê as sessões do modo legado; o mesmo no fallback-raiz.                                                                            |
| `AUTH_SECRET`                                       | Opcional   | Ausente                                                                        | Só como reserva de `NEXTAUTH_SECRET`.                                                                                              |
| `NEXTAUTH_DEBUG`                                    | Opcional   | `false`                                                                        | Registro do NextAuth.                                                                                                              |
| `GOOGLE_CLIENT_ID`                                  | Opcional   | Credencial OAuth do Google                                                     | Callback em `https://app.<raiz>` registrado no console antes do corte (C4).                                                        |
| `GOOGLE_CLIENT_SECRET`                              | Opcional   | Segredo OAuth do Google                                                        | Idem.                                                                                                                              |
| `FACEBOOK_CLIENT_ID`                                | Opcional   | Credencial OAuth do Facebook                                                   | Idem.                                                                                                                              |
| `FACEBOOK_CLIENT_SECRET`                            | Opcional   | Segredo OAuth do Facebook                                                      | Idem.                                                                                                                              |
| `CRON_SECRET`                                       | Sim        | Segredo do agendador                                                           | A Vercel o envia como `Authorization: Bearer` nos crons deste projeto; o mesmo valor no segredo do `cron-dispatch` (D10).          |
| `RESEND_API_KEY`                                    | Sim        | Chave do Resend                                                                | Sem ela, os e-mails de identidade falham e os avisos comerciais ficam PENDING.                                                     |
| `FROM_EMAIL`                                        | Sim        | Remetente validado no Resend                                                   | Idem.                                                                                                                              |
| `NEXT_PUBLIC_SUPABASE_URL`                          | Sim        | URL do projeto Supabase                                                        | Documentos privados e imagens.                                                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`                         | Sim        | Chave de serviço do Supabase                                                   | Só no servidor.                                                                                                                    |
| `ZOHO_CLIENT_ID`                                    | Opcional   | Credencial OAuth do Zoho                                                       | Só se a caixa de e-mail do painel for usada.                                                                                       |
| `ZOHO_CLIENT_SECRET`                                | Opcional   | Segredo OAuth do Zoho                                                          | Idem.                                                                                                                              |
| `ZOHO_MAIL_DATACENTER`                              | Opcional   | `com` (padrão) ou o datacenter da conta                                        | Idem.                                                                                                                              |
| `ZOHO_REDIRECT_URI`                                 | Opcional   | Ausente, ou exatamente `https://app.<raiz>/api/admin/zoho-mail/oauth/callback` | Outro valor lança erro (redirect fixo no `app.`). Re-registrar no Zoho (C4).                                                       |
| `PLATFORM_WEBHOOK_ORIGIN`                           | Sim        | `<origem-api>` (D5)                                                            | Webhook das subcontas = origem + `/api/webhooks/asaas/{id}`. **Nunca muda depois**: trocar vira `WEBHOOK_OWNERSHIP_CONFLICT`.      |
| `PLATFORM_OPS_EMAIL`                                | Sim        | Caixa de alertas da operação                                                   | Alertas de conta de recebimentos e conflitos.                                                                                      |
| `PLATFORM_ASAAS_ENVIRONMENT`                        | Sim        | `sandbox` até a homologação (S16)                                              | `production` só com o aceite da cobrança da assinatura; ausente deixa avisos comerciais PENDING.                                   |
| `PLATFORM_ASAAS_ROOT_API_KEY`                       | Opcional   | Chave da conta raiz da plataforma                                              | Só com a cobrança da assinatura e as subcontas ligadas.                                                                            |
| `PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256`          | Opcional   | SHA-256 (hex) do token do webhook raiz                                         | Nunca o token em claro.                                                                                                            |
| `PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256` | Opcional   | Hash anterior durante a rotação                                                | Retirar operacionalmente em até 24 h. Não há expiração automática: o hash continua aceito enquanto esta variável estiver definida. |
| `PLATFORM_ASAAS_SUBACCOUNT_MODEL`                   | Opcional   | `STANDARD` no piloto                                                           | `BAAS` só depois do acordo com o Asaas.                                                                                            |
| `PLATFORM_SUBACCOUNT_CREATION`                      | Opcional   | `off`                                                                          | Ligar é ato do lote S16.                                                                                                           |
| `PLATFORM_SUBACCOUNT_REQUIRES_PAID`                 | Opcional   | `true` (padrão)                                                                | Só o literal `false` desliga.                                                                                                      |
| `PLATFORM_ASAAS_EGRESS_PROXY_URL`                   | Opcional   | Vazia                                                                          | Saída por IP fixo para o Asaas.                                                                                                    |
| `PLATFORM_ASAAS_OUTBOUND_DISABLED`                  | Opcional   | `false`                                                                        | Interruptor de emergência: corta as chamadas ao Asaas; webhooks continuam persistidos.                                             |
| `PLATFORM_SECRETS_KEK_PROVIDER`                     | Sim        | `env` até o piloto; `aws-kms` antes do self-service                            | VAULT falha fechada sem KEK.                                                                                                       |
| `PLATFORM_SECRETS_KEK_CURRENT`                      | Opcional   | Id da KEK atual                                                                | Necessária quando houver integração no cofre (VAULT).                                                                              |
| `PLATFORM_SECRETS_KEK_<ID>`                         | Opcional   | KEK de 32 bytes em base64 por id                                               | Família: um nome por id de KEK (ex. `K1`); sensível.                                                                               |
| `PLATFORM_SECRETS_KMS_KEY_ARN`                      | Opcional   | ARN da chave KMS (sa-east-1)                                                   | Só com `aws-kms`.                                                                                                                  |
| `AWS_ROLE_ARN`                                      | Opcional   | Papel federado por OIDC                                                        | Só com `aws-kms`; sem access keys estáticas.                                                                                       |
| `AWS_WEB_IDENTITY_TOKEN_FILE`                       | Opcional   | Arquivo do token OIDC                                                          | Idem.                                                                                                                              |
| `PLATFORM_SECRET_FINGERPRINT_KEY`                   | Opcional   | Chave HMAC (32+)                                                               | Necessária com o cofre e a importação de segredos.                                                                                 |
| `INTEGRATION_ENV_REFS_ALLOWED`                      | Sim        | `true` até a importação para o cofre                                           | Com `true`, cada referência `env:LOCADORA_INTEGRATION_<ID>` usa a família de sufixos abaixo, não a variável base.                  |
| `LOCADORA_INTEGRATION_<ID>_SECRET`                  | Opcional   | Segredo de assinatura da integração                                            | Obrigatório para resolver uma referência `env:` habilitada; ausente ou vazio faz a resolução falhar fechada.                       |
| `LOCADORA_INTEGRATION_<ID>_VERIFY_TOKEN`            | Opcional   | Token de verificação da integração                                             | Conforme o provedor da integração.                                                                                                 |
| `LOCADORA_INTEGRATION_<ID>_API_KEY`                 | Opcional   | Chave do provedor da integração                                                | Conforme o provedor da integração; somente no servidor.                                                                            |
| `LOCADORA_INTEGRATION_<ID>_ENVIRONMENT`             | Opcional   | Ambiente do provedor da integração                                             | Conforme o provedor da integração.                                                                                                 |
| `LOCADORA_INTEGRATION_<ID>_USER_AGENT`              | Opcional   | Identificação do cliente da integração                                         | Conforme o provedor da integração.                                                                                                 |
| `PLATFORM_TRIAL_SECRET`                             | Opcional   | Chave HMAC (32+)                                                               | Cadastro de locadora (onboarding).                                                                                                 |
| `PLATFORM_LEGAL_DOCUMENTS_FILE`                     | Opcional   | Arquivo JSON dos termos aprovados                                              | Só com o cadastro ligado.                                                                                                          |
| `PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE`             | Opcional   | Arquivo JSON com os textos aprovados                                           | Idem.                                                                                                                              |
| `PLATFORM_CAPTCHA_SITE_KEY`                         | Opcional   | Chave pública do Turnstile                                                     | Idem.                                                                                                                              |
| `PLATFORM_CAPTCHA_SECRET_KEY`                       | Opcional   | Segredo do Turnstile                                                           | Idem.                                                                                                                              |
| `PLATFORM_SELF_SERVICE_SIGNUP`                      | Sim        | `off`                                                                          | `on` só depois do H6, da homologação e do KMS.                                                                                     |
| `PLATFORM_SUBSCRIPTION_ENFORCEMENT`                 | Sim        | `off`                                                                          | `on` exige `pnpm platform:preflight` verde.                                                                                        |
| `AUTO_GENERATE_BOLETO_ON_QUOTE`                     | Opcional   | Valor da produção atual                                                        | `true` gera o boleto na aprovação do orçamento.                                                                                    |
| `LOG_LEVEL`                                         | Opcional   | `info`                                                                         | Nível do logger.                                                                                                                   |
| `NODE_ENV`                                          | Automática | `production`                                                                   | Definida pelo `next start`/build.                                                                                                  |
| `VERCEL`                                            | Automática | `1` na Vercel                                                                  | Confia no IP do cliente informado pela Vercel.                                                                                     |
| `VERCEL_ENV`                                        | Automática | `production` no deploy de produção                                             | Sem `PLATFORM_ENV`, conta como produção.                                                                                           |
| `WEB_API_ORIGIN`                                    | Não        | Ausente                                                                        | Pertence ao web (módulo de contrato compartilhado).                                                                                |
| `PLATFORM_LABS_ENABLED`                             | Não        | Ausente                                                                        | Pertence ao web; ignorada em produção.                                                                                             |
| `PLATFORM_PUBLIC_PORT`                              | Não        | Ausente                                                                        | Só development do web.                                                                                                             |

<!-- /manifesto:api -->

## Projeto web (`apps/clients/web`)

Projeto Vercel com Root Directory `apps/clients/web` e
`apps/clients/web/vercel.json` (sem crons). Domínios `<raiz>`, `www.<raiz>`,
`app.<raiz>` e `*.<raiz>`. O web não usa banco: nenhuma variável de banco,
segredo de provedor ou identidade entra aqui (a URL pública do Supabase só serve
às imagens).

<!-- manifesto:web -->

| Variável                          | Configurar | Valor no corte                     | Notas                                                                                                                                                                                       |
| --------------------------------- | ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLATFORM_ENV`                    | Sim        | `production`                       | Lida também no build.                                                                                                                                                                       |
| `PLATFORM_ROOT_DOMAIN`            | Sim        | `<raiz>`                           | Lida no build (`apps/clients/web/next.config.mjs`) e no proxy.                                                                                                                              |
| `PLATFORM_PUBLIC_PORT`            | Opcional   | Ausente                            | Só development (3001).                                                                                                                                                                      |
| `PLATFORM_EDGE_SECRET`            | Sim        | Mesmo valor da API                 | 32 caracteres ou mais.                                                                                                                                                                      |
| `PLATFORM_EDGE_SECRET_PREVIOUS`   | Opcional   | Valor anterior durante a rotação   | Mesmo valor da API.                                                                                                                                                                         |
| `PLATFORM_LABS_ENABLED`           | Opcional   | Ausente                            | Ignorada em produção.                                                                                                                                                                       |
| `WEB_API_ORIGIN`                  | Sim        | `<origem-api>`                     | Só a origem, em https, sem caminho. No retorno (7.3) o domínio da API muda de projeto, não esta variável.                                                                                   |
| `NEXT_PUBLIC_AUTH_MODE`           | Sim        | `better-auth` (D3)                 | Embutida no build: trocar exige rebuild. Igual ao `AUTH_MODE` da API.                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_URL`        | Sim        | Mesmo valor da API                 | Lida no build (`apps/clients/web/next.config.mjs`): o hostname do Supabase entra em `images.remotePatterns` (fotos, logo e carrossel); sem ela o otimizador recusa as fotos. Não é segredo. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Opcional   | Chave da produção atual            | Mapa da página de contato; restringir a chave aos domínios novos.                                                                                                                           |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | Opcional   | Map ID da produção atual           | Idem.                                                                                                                                                                                       |
| `NODE_ENV`                        | Automática | `production`                       | Definida pelo Next.js.                                                                                                                                                                      |
| `VERCEL_ENV`                      | Automática | `production` no deploy de produção | Sem `PLATFORM_ENV`, conta como produção.                                                                                                                                                    |

<!-- /manifesto:web -->

## Projeto `fallback-raiz` (raiz da tag de pré-exclusão)

> O antigo next.config.mjs e o antigo vercel.json da raiz foram retirados no
> clone F. O fallback conserva esses arquivos somente nos blobs da tag C, nunca
> como configuração da árvore atual.

Projeto Vercel com Root Directory na raiz do repositório, publicado a partir da
tag `checkpoint/onda-135-pre-exclusao`, **sem domínio** e com os Cron Jobs
desligados nas configurações (runbook, 7.1-4). Ele só recebe tráfego no retorno
(7.3), quando o domínio da origem pública da API passa para ele. Por isso as
variáveis compartilhadas com a API têm **os mesmos valores** dela (mesmo banco,
mesmos segredos e o mesmo `PLATFORM_WEBHOOK_ORIGIN`); as exclusivas da raiz
(medição e verificação do site da GB) repetem as do projeto de produção atual,
lidas sem alterar.

<!-- manifesto:fallback-raiz -->

| Variável                                            | Configurar | Valor no corte                     | Notas                                                                                                              |
| --------------------------------------------------- | ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                      | Sim        | Igual à API                        | Banco migrado com o conjunto da tag, a ser provado no P0 antes do corte; a árvore de 2026-10-08 tem 35 migrations. |
| `PLATFORM_DATABASE_URL`                             | Sim        | Igual à API                        |                                                                                                                    |
| `PLATFORM_ENV`                                      | Sim        | `production`                       |                                                                                                                    |
| `PLATFORM_ROOT_DOMAIN`                              | Sim        | `<raiz>`                           |                                                                                                                    |
| `PLATFORM_EDGE_SECRET`                              | Sim        | Igual à API e ao web               | O web aponta para o mesmo domínio da API, que passa a ser deste projeto.                                           |
| `PLATFORM_EDGE_SECRET_PREVIOUS`                     | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_RATE_LIMIT_SECRET`                        | Sim        | Igual à API                        |                                                                                                                    |
| `TRUSTED_PROXY_HOPS`                                | Opcional   | Igual à API                        |                                                                                                                    |
| `WEB_PUBLIC_ORIGIN`                                 | Opcional   | Igual à API                        |                                                                                                                    |
| `AUTH_MODE`                                         | Sim        | `better-auth` (D3)                 | Igual à API; volta junto com o `NEXT_PUBLIC_AUTH_MODE` do web.                                                     |
| `AUTH_V2_ENABLED`                                   | Opcional   | Igual à API                        |                                                                                                                    |
| `AUTH_CREDENTIAL_WRITES_PAUSED`                     | Opcional   | Igual à API                        |                                                                                                                    |
| `BETTER_AUTH_URL`                                   | Sim        | `https://app.<raiz>`               |                                                                                                                    |
| `BETTER_AUTH_SECRET`                                | Sim        | Igual à API                        | Sessões sobrevivem ao retorno.                                                                                     |
| `AUTH_TRUSTED_ORIGINS`                              | Opcional   | Igual à API                        |                                                                                                                    |
| `BETTER_AUTH_TRUSTED_ORIGINS`                       | Não        | Ausente                            |                                                                                                                    |
| `NEXTAUTH_URL`                                      | Sim        | `https://app.<raiz>`               |                                                                                                                    |
| `NEXTAUTH_SECRET`                                   | Sim        | Igual à API                        |                                                                                                                    |
| `AUTH_SECRET`                                       | Opcional   | Ausente                            |                                                                                                                    |
| `NEXTAUTH_DEBUG`                                    | Opcional   | `false`                            |                                                                                                                    |
| `GOOGLE_CLIENT_ID`                                  | Opcional   | Igual à API                        |                                                                                                                    |
| `GOOGLE_CLIENT_SECRET`                              | Opcional   | Igual à API                        |                                                                                                                    |
| `FACEBOOK_CLIENT_ID`                                | Opcional   | Igual à API                        | Também lida pelo layout da raiz.                                                                                   |
| `FACEBOOK_CLIENT_SECRET`                            | Opcional   | Igual à API                        |                                                                                                                    |
| `CRON_SECRET`                                       | Sim        | Igual à API                        | Os Cron Jobs do projeto ficam desligados; só ligam no retorno.                                                     |
| `RESEND_API_KEY`                                    | Sim        | Igual à API                        |                                                                                                                    |
| `FROM_EMAIL`                                        | Sim        | Igual à API                        |                                                                                                                    |
| `NEXT_PUBLIC_SUPABASE_URL`                          | Sim        | Igual à API                        | Também lida no build (`images.remotePatterns` da raiz).                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                         | Sim        | Igual à API                        |                                                                                                                    |
| `ZOHO_CLIENT_ID`                                    | Opcional   | Igual à API                        |                                                                                                                    |
| `ZOHO_CLIENT_SECRET`                                | Opcional   | Igual à API                        |                                                                                                                    |
| `ZOHO_MAIL_DATACENTER`                              | Opcional   | Igual à API                        |                                                                                                                    |
| `ZOHO_REDIRECT_URI`                                 | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_WEBHOOK_ORIGIN`                           | Sim        | Igual à API (`<origem-api>`)       | Nunca muda: o retorno só troca o projeto que atende esse domínio.                                                  |
| `PLATFORM_OPS_EMAIL`                                | Sim        | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_ENVIRONMENT`                        | Sim        | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_ROOT_API_KEY`                       | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256`          | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256` | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_SUBACCOUNT_MODEL`                   | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_SUBACCOUNT_CREATION`                      | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_SUBACCOUNT_REQUIRES_PAID`                 | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_EGRESS_PROXY_URL`                   | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_ASAAS_OUTBOUND_DISABLED`                  | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_SECRETS_KEK_PROVIDER`                     | Sim        | Igual à API                        |                                                                                                                    |
| `PLATFORM_SECRETS_KEK_CURRENT`                      | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_SECRETS_KEK_<ID>`                         | Opcional   | Igual à API                        | Família, como na API.                                                                                              |
| `PLATFORM_SECRETS_KMS_KEY_ARN`                      | Opcional   | Igual à API                        |                                                                                                                    |
| `AWS_ROLE_ARN`                                      | Opcional   | Igual à API                        |                                                                                                                    |
| `AWS_WEB_IDENTITY_TOKEN_FILE`                       | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_SECRET_FINGERPRINT_KEY`                   | Opcional   | Igual à API                        |                                                                                                                    |
| `INTEGRATION_ENV_REFS_ALLOWED`                      | Sim        | Igual à API                        | E as mesmas famílias de sufixos das referências `env:LOCADORA_INTEGRATION_<ID>`.                                   |
| `LOCADORA_INTEGRATION_<ID>_SECRET`                  | Opcional   | Igual à API                        | Obrigatório para resolver a referência `env:` habilitada.                                                          |
| `LOCADORA_INTEGRATION_<ID>_VERIFY_TOKEN`            | Opcional   | Igual à API                        | Conforme a integração.                                                                                             |
| `LOCADORA_INTEGRATION_<ID>_API_KEY`                 | Opcional   | Igual à API                        | Conforme a integração; somente no servidor.                                                                        |
| `LOCADORA_INTEGRATION_<ID>_ENVIRONMENT`             | Opcional   | Igual à API                        | Conforme a integração.                                                                                             |
| `LOCADORA_INTEGRATION_<ID>_USER_AGENT`              | Opcional   | Igual à API                        | Conforme a integração.                                                                                             |
| `PLATFORM_TRIAL_SECRET`                             | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_LEGAL_DOCUMENTS_FILE`                     | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE`             | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_CAPTCHA_SITE_KEY`                         | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_CAPTCHA_SECRET_KEY`                       | Opcional   | Igual à API                        |                                                                                                                    |
| `PLATFORM_SELF_SERVICE_SIGNUP`                      | Sim        | Igual à API                        |                                                                                                                    |
| `PLATFORM_SUBSCRIPTION_ENFORCEMENT`                 | Sim        | Igual à API                        |                                                                                                                    |
| `AUTO_GENERATE_BOLETO_ON_QUOTE`                     | Opcional   | Igual à API                        |                                                                                                                    |
| `LOG_LEVEL`                                         | Opcional   | Igual à API                        |                                                                                                                    |
| `WEB_API_ORIGIN`                                    | Não        | Ausente                            | Pertence ao web.                                                                                                   |
| `PLATFORM_LABS_ENABLED`                             | Não        | Ausente                            | Ignorada em produção.                                                                                              |
| `PLATFORM_PUBLIC_PORT`                              | Não        | Ausente                            | Só development.                                                                                                    |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`                     | Opcional   | Igual ao projeto de produção atual | Medição do site da GB, embutida no build da raiz.                                                                  |
| `NEXT_PUBLIC_GOOGLE_ADS_ID`                         | Opcional   | Igual ao projeto de produção atual | Idem.                                                                                                              |
| `GOOGLE_SITE_VERIFICATION`                          | Opcional   | Igual ao projeto de produção atual | Verificação do Search Console no layout da raiz.                                                                   |
| `FACEBOOK_DOMAIN_VERIFICATION`                      | Opcional   | Igual ao projeto de produção atual | Verificação de domínio da Meta no layout da raiz.                                                                  |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                   | Opcional   | Igual ao projeto de produção atual |                                                                                                                    |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`                    | Opcional   | Igual ao projeto de produção atual |                                                                                                                    |
| `NODE_ENV`                                          | Automática | `production`                       |                                                                                                                    |
| `CI`                                                | Automática | Definida pelo executor de CI       | O build da raiz desliga source maps do servidor quando presente; não é segredo nem configuração de runtime.        |
| `VERCEL`                                            | Automática | `1` na Vercel                      |                                                                                                                    |
| `VERCEL_ENV`                                        | Automática | `production` no deploy de produção |                                                                                                                    |

<!-- /manifesto:fallback-raiz -->

## Fora dos três projetos

- **Agendador do GitHub** (`.github/workflows/cron-dispatch.yml`, no repositório
  da D10): segredos `CRON_BASE_URL` = `<origem-api>` e `CRON_SECRET` = o da API.
- **Mobile** (`apps/clients/mobile/.env.example`, app ainda não publicado):
  `EXPO_PUBLIC_API_URL` = `<origem-api>`, `EXPO_PUBLIC_ASSET_URL` = a origem do
  web e `EXPO_PUBLIC_WEB_URL` = `https://app.<raiz>`. Nunca segredo em
  `EXPO_PUBLIC_*`.
- **Migração do banco** (runbook 7.2-3): `DATABASE_URL` com o papel dono, só na
  máquina do operador, nunca em projeto publicado.
