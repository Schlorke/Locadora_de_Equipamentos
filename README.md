# Casa preparada para a plataforma de locadoras

**Seção candidata, somente scratch.** A estrutura abaixo será a referência após
a retirada do aplicativo raiz e a validação do clone. Não declara a
aposentadoria, o ambiente hospedado, as integrações ou a publicação prontos.

O produto tem três hosts: web em `apps/clients/web`, API em `apps/services/api`
e aplicativo Expo em `apps/clients/mobile`. O web e o mobile consomem as mesmas
fatias de produto em `packages/frontend/src`, organizadas em Feature-Sliced
Design; componentes e tokens vivem em `packages/ui` e `packages/design-tokens`.
O servidor usa `packages/backend`, regras de negócio usam `packages/domain` e
formatos compartilhados usam `packages/contracts`. O namespace atual
`@gb-locacoes` é preservado.

Cada host possui seu próprio `.env.example`: `apps/clients/web/.env.example`,
`apps/services/api/.env.example` e `apps/clients/mobile/.env.example`. São
exemplos de configuração, sem credenciais prontas. A raiz também mantém
`.env.example` para ferramentas; não copiar valores reais de outro ambiente. O
web aponta `WEB_API_ORIGIN` para a API; o aplicativo usa `EXPO_PUBLIC_API_URL` e
`EXPO_PUBLIC_ASSET_URL`. Em aparelho físico, as origens devem ser acessíveis
pelo aparelho. Segredos permanecem no servidor e nunca entram em `NEXT_PUBLIC_*`
ou `EXPO_PUBLIC_*`.

Para preparar um ambiente local sem ativar integrações externas, usar
`PLATFORM_ENV=development`, `PLATFORM_SELF_SERVICE_SIGNUP=off`,
`PLATFORM_SUBACCOUNT_CREATION=off`, `PLATFORM_SUBSCRIPTION_ENFORCEMENT=off` e
definir explicitamente `PLATFORM_ASAAS_OUTBOUND_DISABLED=true` no ambiente
local. Este último é um override: o exemplo da API atualmente contém `false`.
Deixar credenciais de provedores e `CRON_SECRET` sem configuração; não ligar
scheduler, webhook, OAuth, envio de e-mail ou provisionamento antes dos
respectivos contratos e credenciais próprios. As flags Asaas não desligam todo
provedor: a ausência de credenciais e a configuração de cada integração precisam
ser conferidas. Essas escolhas de preparação não substituem o ambiente
específico das suítes de validação.

O motor de autenticação deve ser coerente entre `AUTH_MODE` na API,
`NEXT_PUBLIC_AUTH_MODE` no build web e `EXPO_PUBLIC_AUTH_MODE` no mobile. O
exemplo local usa `legacy`; a decisão do corte prevê Better Auth e exige os
builds correspondentes. Para SSR no modo legado, a URL interna não pode ser uma
string vazia; configurar `NEXTAUTH_URL_INTERNAL` com a mesma origem local
aplicável de `NEXTAUTH_URL`. Compartilhar somente segredos sintéticos próprios
no ambiente local.

Com Node 24 e pnpm 10.27.0, os comandos reais do candidato são:

| Objetivo                      | Comando                                   |
| ----------------------------- | ----------------------------------------- |
| Gerar o cliente Prisma        | `pnpm db:generate`                        |
| Iniciar web3001 e API3002     | `pnpm dev`                                |
| Iniciar Expo                  | `pnpm --filter @gb-locacoes/mobile start` |
| Construir web e API           | `pnpm build`                              |
| Empacotar Android e iOS       | `pnpm bundle:mobile`                      |
| Construir Storybook           | `pnpm build-storybook`                    |
| Conferir arquitetura e tokens | `pnpm arch` e `pnpm tokens`               |
| Conferir tipos do workspace   | `pnpm typecheck`                          |
| Conferir CSS e higiene        | `pnpm lint:css` e `pnpm hygiene`          |
| Executar as suítes declaradas | `pnpm test:all`                           |

A execução deve ser coordenada com banco descartável próprio, variáveis de teste
e saídas externas; `test:all` não é por si só prova de jornadas de navegador,
visual, Docker ou todas as mutações do clone. Após configurar apenas o banco
local alvo, aplicar migrations com `pnpm exec prisma migrate deploy`; não usar
`db push` ou reset como preparação. Os comandos destrutivos/operacionais antigos
existentes não são um roteiro de setup.

O Compose preparado é apenas um candidato local: projeto novo
`locadora-equipamentos-saas`, volume novo `locadora-equipamentos-saas-pg18`,
PostgreSQL18 e API em portas loopback. Não ativa Docker, não reutiliza dados
PostgreSQL15 e depende de revisão e smoke test próprios. Não existe nesta
entrega uma conta PostgreSQL cloud criada ou configurada. Hospedagem, banco
gerenciado, papéis/RLS, domínio, segredo de borda, KMS, storage, e-mail, Asaas e
observabilidade são configuração futura por ambiente, sem reaproveitar bancos,
volumes, credenciais ou repositório legados. Publicação em produção permanece
fora desta preparação.
