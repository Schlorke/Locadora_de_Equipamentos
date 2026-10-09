# Runbook do corte de produção da raiz legada

Estado em 2026-10-08, onda 135, Lote C (C7). Procedimento de referência para o
dono, não uma autorização: nenhum agente publica, faz push, migra o banco de
produção, troca DNS, mexe em provedor ou liga agenda real. Os passos das seções
7.1, 7.2 e do retorno são ações do dono, no painel ou na máquina dele. Fonte:
seção 7 do plano da onda 135 e as respostas do dono de 2026-10-08.

`<raiz>` é o domínio da plataforma (D1), `<origem-api>` é a origem pública da
API (D5) e `gb` é o slug da GB. As variáveis de cada projeto, com o valor de
cada uma no corte, estão no [manifesto de variáveis](manifesto-variaveis.md).

## Decisões

| ID  | Decisão                                         | Estado                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D0  | Quando apagar a raiz no repositório             | **Decidida (b):** logo depois das provas P0, P1 e P2 e da tag `checkpoint/onda-135-pre-exclusao`, sem esperar este corte. A raiz da tag é o artefato do `fallback-raiz`.                                                                                         |
| D3  | Modo de autenticação no corte                   | **Decidida: Better Auth.** `AUTH_MODE` da API e do fallback-raiz e `NEXT_PUBLIC_AUTH_MODE` do web valem `better-auth` e mudam juntos (rebuild do web).                                                                                                           |
| D4  | Medição e verificação do site                   | **Decidida:** campos por locadora no painel (GA4, Google Ads, Search Console e Meta), gravados para a GB pelo `tools/gb-site-settings.mjs`; Vercel Analytics e Speed Insights no layout do web.                                                                  |
| D9  | Quarentenas COD-03/04/25                        | **Decidida: portar.** O Google Merchant segue desligado: rotas 503 e o cron fora da agenda.                                                                                                                                                                      |
| D1  | Domínio e DNS                                   | **No dia do corte.** Opções: nameservers da Vercel (certificado curinga automático para `*.<raiz>`) ou certificado curinga emitido fora e DNS próprio. Decidir antes do staging.                                                                                 |
| D2  | `locacoesgb.com.br`                             | **No dia do corte.** Opções: (a) 308 na Vercel, no projeto web, para `gb.<raiz>` preservando caminho e query (exige a emenda L12 antes do L11 na ADR de hosts); (b) domínio próprio da locadora antes do corte (Lote 11).                                        |
| D5  | Origem pública da API                           | **No dia do corte.** Opções: `api.<raiz>` (subdomínio já reservado; exige emendar a alternativa rejeitada "hosts `api.` próprios" da ADR de hosts) ou o domínio do projeto na Vercel. Fixa para sempre o `PLATFORM_WEBHOOK_ORIGIN`.                              |
| D6  | Hospedagem e plano                              | **No dia do corte.** Opções: três projetos Vercel (API, web e fallback-raiz) num plano que aceite cron por minuto (o Hobby só aceita cron diário e recusa o deploy com expressão mais frequente) e `maxDuration` 300; ou a imagem da API em Docker próprio (C3). |
| D7  | Janela de estabilidade                          | **No dia do corte.** Duração da janela, retenção do `fallback-raiz` e do projeto do `main`, e os gatilhos de retorno (seção "Retorno").                                                                                                                          |
| D10 | Repositório que mantém o `cron-dispatch` GitHub | **No dia do corte.** Opções: `origin` (`Schlorke/Locadora_de_Equipamentos`, o destino autorizado) ou passar os 5 jobs do GitHub para crons da Vercel no projeto da API. O workflow do GB-Locacoes é desativado no passo 2 e não volta.                           |

## Dois repositórios, dois papéis

- **Produção atual:** o projeto Vercel ligado a `Schlorke/GB-Locacoes`, branch
  `main`. Nada desta branch chega lá: o push para esse repositório é bloqueado e
  [deploy](../getting-started/deployment.md) proíbe publicar nele.
- **Destino:** `Schlorke/Locadora_de_Equipamentos` (`origin`). Os projetos novos
  (API, web e `fallback-raiz`) se ligam a ele, ou recebem deploy por CLI a
  partir de um clone limpo. Qualquer push para `origin` é ação do dono.
- **Consequência:** apagar a raiz neste repositório (D0) não muda a produção, e
  o projeto do `main` nunca vai recompilar uma raiz apagada.

## Agendas

| Agenda                                   | Onde                                                                     | Jobs                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Vercel, projeto do `main` (produção)     | `vercel.json` do `main`                                                  | `late-fees`, `expire-quotes`, `sync-google-merchant`                                                                     |
| GitHub, "External Cron Dispatch"         | `.github/workflows/cron-dispatch.yml`, **em cada repositório** onde roda | `auto-convert-quotes`, `send-notifications`, `verify-boleto-payments`, `boleto-overdue-alerts`, `preventive-maintenance` |
| Vercel, projeto da API (depois do corte) | `apps/services/api/vercel.json`                                          | `late-fees` e `expire-quotes` às 00:00 UTC, `outbox` a cada minuto                                                       |
| Vercel, `fallback-raiz`                  | `vercel.json` da raiz da tag (4 crons, inclusive `outbox` por minuto)    | **Sempre desligados** nas configurações do projeto; só ligam no retorno                                                  |

Regras: uma autoridade por job (o teste `tests/unit/host-deploy-config.test.ts`
reprova job nas duas agendas da Vercel e do GitHub); o web nunca agenda nem
recebe cron (404 em todo host). `sync-google-merchant` fica fora (sempre 503,
D9). `/api/cron/platform` não tem agenda: entra a cada 5 minutos só quando os
jobs da plataforma forem ligados, no mesmo passo em que `PLATFORM_DATABASE_URL`
estiver configurada.

Fatos da Vercel usados abaixo (documentação consultada em 2026-10-08,
[Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)): crons
só valem no deploy de produção; **Settings → Cron Jobs → Disable Cron Jobs**
desliga pelo painel (mudar ou apagar um cron exige redeploy); cron não segue
redirecionamento; a entrega é "best effort" e pode repetir uma execução (os jobs
daqui são idempotentes por checkpoint e outbox); o Instant Rollback volta os
crons ao estado do deploy anterior; com `CRON_SECRET` no projeto, a Vercel envia
`Authorization: Bearer <CRON_SECRET>`. O `engines.node` do `package.json` do
Root Directory prevalece sobre a versão do painel
([Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)).

## 7.1 Antes (dono)

1. Decidir D1, D2, D5, D6, D7 e D10.
2. Ler, sem alterar:
   - o projeto Vercel que publica o `main` e o plano da conta;
   - `NEXTAUTH_URL` e `AUTH_MODE` reais;
   - o `CRON_BASE_URL` **de cada repositório** e o histórico do "External Cron
     Dispatch" em cada um;
   - as URLs de webhook do Asaas da GB, ZapSign e Meta;
   - as URIs OAuth (Google, Facebook e Zoho);
   - o `Setting.publicBaseUrl` da GB;
   - as referências `env:` de `TenantIntegration.credentialsRef`.
3. **Staging** (Lote 8 da ADR de hosts): projetos web, API e `fallback-raiz`,
   cada um com seu Root Directory, Node 24 (`engines` dos hosts), banco próprio,
   `staging.<raiz>` e `*.staging.<raiz>`. Provar:
   - build na Vercel (web: `apps/clients/web/vercel.json`; API:
     `apps/services/api/vercel.json`);
   - T5–T10, T13 e T16 da ADR de hosts;
   - limites de corpo e tempo do rewrite (upload multipart e PDF);
   - carga (pool de 1–2 conexões por processo, C9);
   - provedores em sandbox;
   - os critérios de [aceite](../guides/shared-api-acceptance.md);
   - o 308 do domínio da GB por `curl`, inclusive `/reset-password`,
     `/sitemap.xml` e `/admin` (se D2 = a);
   - **o retorno pelo mesmo mecanismo da seção "Retorno"**: reatribuir o domínio
     da API de staging ao `fallback-raiz`, religar a agenda nele e desligar na
     API, com login, orçamento, PDF e webhook de dublê sobre o banco migrado do
     staging.
4. **Criar o projeto `fallback-raiz` de produção**:
   - fonte: o commit da tag `checkpoint/onda-135-pre-exclusao` (por `origin`,
     num ramo que aponte para a tag, ou por CLI a partir de um clone limpo);
   - Root Directory = raiz do repositório;
   - variáveis da tabela `fallback-raiz` do [manifesto](manifesto-variaveis.md),
     com os mesmos valores da API;
   - **sem domínio**;
   - **Cron Jobs desligados** nas configurações do projeto antes do primeiro
     deploy de produção (a raiz da tag traz 4 crons, com o outbox por minuto). O
     primeiro deploy de um projeto novo na Vercel é sempre de produção, e o
     banco de produção ainda não está migrado nesta etapa: criar o projeto sem
     deploy automático (por CLI, configurando antes do primeiro
     `vercel deploy --prod`) e fazer o primeiro deploy de produção só no 7.2-5.
     O staging (passo 3) cria o `fallback-raiz` pelo mesmo caminho e confirma
     que nenhum cron roda (**a conferir** no painel);
   - o projeto do `main` **não** é alvo de retorno.
5. Ensaio do banco numa cópia restaurada da produção: baseline + 34 migrations +
   preflight ([multiempresa](../architecture/multiempresa.md)),
   `pnpm tenant:check`, `pnpm platform:preflight`, e o `fallback-raiz` sobre
   ela.

## 7.2 Dia do corte (dono, nesta ordem)

1. Janela anunciada e snapshot/PITR do banco.
2. **Parar as agendas e a escrita do `main` antes de migrar:**
   - desligar os Cron Jobs do projeto Vercel do `main`;
   - desativar o workflow "External Cron Dispatch" no repositório
     **GB-Locacoes** (ou esvaziar o `CRON_BASE_URL` de lá);
   - servir manutenção no domínio da GB, o que bloqueia escrita de usuários;
   - registrar o horário.
   - Webhooks: o Asaas guarda os eventos por quatorze dias e interrompe a fila
     após quinze falhas ([runbook de webhooks](runbook-asaas-webhooks.md)).
     Fixar a janela máxima pela política de tentativas do Asaas (a conferir) ou
     aceitar a interrupção e reativar pelo procedimento documentado. Nenhuma
     agenda volta até o passo 9.
3. Migrar com o papel dono: `pnpm exec prisma migrate deploy` (nunca `db push`),
   com `DATABASE_URL` do papel dono só na máquina do operador.
4. Dados da GB: `tools/gb-site-settings.mjs`, primeiro em simulação e depois com
   `--apply` ([gb-site-settings](gb-site-settings.md)); frota, nota e frete;
   `TenantIntegration`; `pnpm platform:secrets-import`.
5. **Primeiro deploy de produção do `fallback-raiz` e fumaça sobre o banco
   migrado**, com os Cron Jobs ainda desligados, pelo URL do próprio deploy:
   `/api/health` e leituras públicas. Login, orçamento, PDF e webhook de dublê
   já foram provados no staging com o mesmo artefato. Na produção não se grava
   dado de teste.
6. Projeto **API**: Cron Jobs **desligados** nas configurações antes do primeiro
   deploy de produção (o `vercel.json` já traz a agenda; mesmo caminho do
   `fallback-raiz` no 7.1-4); domínio da origem pública (D5); variáveis da
   tabela API do manifesto. `PLATFORM_WEBHOOK_ORIGIN` = `<origem-api>`, e
   **nunca muda depois**.
7. Projeto **web**: domínios `<raiz>`, `www.<raiz>`, `app.<raiz>` e `*.<raiz>`;
   `WEB_API_ORIGIN` = `<origem-api>`; `NEXT_PUBLIC_AUTH_MODE` = `better-auth`
   (D3), com rebuild.
8. Fumaça do novo: `/api/health`, vitrine da GB em `gb.<raiz>`, login da equipe
   em `app.<raiz>`, área do cliente, um orçamento, PDF, upload.
9. **Agenda numa autoridade só:**
   - ligar os Cron Jobs do projeto da API (`late-fees` e `expire-quotes` às
     00:00 UTC, `outbox` a cada minuto; `sync-google-merchant` fica fora);
   - o `cron-dispatch` roda só no repositório da D10 (padrão: `origin`), com o
     segredo `CRON_BASE_URL` = `<origem-api>` e o mesmo `CRON_SECRET` da API;
     ou, na outra opção da D10, os 5 jobs passam para o `vercel.json` da API;
   - o workflow do GB-Locacoes segue desativado (passo 2);
   - o `fallback-raiz` segue com os crons desligados.
10. Webhooks re-registrados por integração em
    `<origem-api>/api/webhooks/asaas/{integrationId}`,
    `<origem-api>/api/contracts/zapsign-webhook/{integrationId}` e
    `<origem-api>/api/webhooks/whatsapp/{integrationId}`, com um evento real
    conferido por provedor antes de desligar a URL antiga (as globais respondem
    410).
11. OAuth: Google e Facebook (`https://app.<raiz>/api/auth/callback/<provedor>`
    no modo `better-auth`) e Zoho
    (`https://app.<raiz>/api/admin/zoho-mail/oauth/callback`).
12. Domínio da GB (D2):
    - opção (a): redirecionamento na Vercel, no projeto web, 308 de
      `locacoesgb.com.br` e `www.` para `gb.<raiz>`, preservando caminho e
      query, conferido por `curl` (inclusive `/reset-password`, `/sitemap.xml` e
      `/admin`; o host da locadora já manda `/admin/**` para o `app.`). O
      redirecionamento de domínio do painel exige os dois domínios no mesmo
      projeto; se o curinga não servir de destino, usar um `redirects` do
      `vercel.json` do web com `has` de host. Registrar a emenda da ADR de hosts
      (Lote 12 antes do Lote 11). Cron e webhook não seguem redirecionamento:
      por isso eles já apontam para `<origem-api>` (passos 9 e 10);
    - opção (b): domínio próprio da GB (Lote 11) antes do corte.
    - Depois: `publicBaseUrl` da GB, mudança de endereço no Search Console
      (verificação por DNS) e links de Business/Ads.
13. Monitorar de 24 a 72 h: 5xx, webhooks entregues, crons executados **uma**
    vez, e-mails, logins.
14. O projeto do `main` fica **parado, não apagado**: crons desligados, sem
    domínio, workflow do GB-Locacoes desativado.

## Retorno (7.3)

- **Alvo único: o projeto `fallback-raiz`** (raiz da tag de pré-exclusão). Ele é
  compatível com o banco migrado, porque o P0 rodou essa raiz sobre as 34
  migrations, e foi ensaiado no staging. Vale antes e depois da exclusão da raiz
  no repositório, porque essa exclusão não altera o deploy.
- **Mecanismo:**
  1. reatribuir o domínio da origem pública da API ao `fallback-raiz`. Webhooks,
     mobile, `CRON_BASE_URL` e o `WEB_API_ORIGIN` do web seguem o domínio, e
     `PLATFORM_WEBHOOK_ORIGIN` não muda;
  2. no mesmo passo, ligar os Cron Jobs no `fallback-raiz` e desligar na API;
  3. se o próprio web falhar, tirar o 308 e apontar `locacoesgb.com.br` para o
     `fallback-raiz`, que serve o site da GB como antes;
  4. `AUTH_MODE` e `NEXT_PUBLIC_AUTH_MODE` só mudam juntos, com rebuild do web.
- **Voltar ao `main`** exige restaurar o snapshot de antes da migração e **perde
  tudo o que foi gravado na janela**. É último recurso, com aceite explícito do
  dono.
- **No repositório:** `git revert` do commit de exclusão (local), só se o
  desenvolvimento precisar. A produção não depende disso.
- **Gatilhos** (fixar na D7): 5xx acima do normal, webhook sem entrega, login
  quebrado, cron duplicado ou ausente, perda de dado.

## Artefatos preparados no repositório

| Artefato                                         | Conteúdo                                                                                            | Prova                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/clients/web/vercel.json`                   | Next.js, build pelo filtro do workspace, sem crons                                                  | `tests/unit/host-deploy-config.test.ts`        |
| `apps/services/api/vercel.json`                  | Next.js, build pelo filtro e os 3 crons da Vercel                                                   | idem; `web-operations.http.test.ts` (test:api) |
| `engines.node` dos dois hosts                    | `>=24.21.0 <25`, igual à raiz                                                                       | `tests/unit/host-deploy-config.test.ts`        |
| `apps/services/api/Dockerfile` no CI             | job `api-docker`: build, 200 em `/api/health` e usuário não-root                                    | `tests/unit/ci-workflow.test.ts`               |
| [manifesto de variáveis](manifesto-variaveis.md) | API, web e fallback-raiz, conferidos com o código                                                   | `tests/unit/env-manifest.test.ts`              |
| `.env.example` da API e do web                   | Exatamente as variáveis configuráveis do manifesto                                                  | idem                                           |
| Scripts operacionais sem a raiz                  | `db:backfill:quote-codes`, `db:dedupe:boletos` e os avulsos portados; quarentenas em `scripts/ops/` | `tests/unit/scripts-root-independence.test.ts` |
| Scripts de performance                           | Medem `http://gb.localhost:3001` (host da locadora) ou `--base-url`                                 | `tests/unit/performance-scripts.test.ts`       |
