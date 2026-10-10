# Solução de problemas no workspace atual

Web e API são hosts separados em `apps/clients/web` e `apps/services/api`. Use o
comando e o processo do host afetado; a aplicação antiga da raiz foi retirada em
F. A publicação C não certifica este clone F nem autoriza alteração de banco
hospedado, infraestrutura ou produção. O guia anterior completo está preservado
no
[arquivo histórico](../archive/wave135-pre-f/getting-started/troubleshooting.md.source).

## Limpeza segura e processos

O pnpm usa links no `node_modules`. Não apague essa árvore recursivamente nem
encerre todos os processos Node. Confirme o caminho absoluto, os links e os PIDs
próprios antes de uma limpeza. Instalação interrompida deve ser corrigida pelo
pnpm, preservando o lock e os demais checkouts; não por um script de remoção
manual. A antiga `scripts/clean-install-windows.ps1` foi retirada.

Saídas de ferramentas ficam fora do repositório. A `.next` antiga da raiz foi
retirada em F; builds atuais produzem `apps/clients/web/.next` e
`apps/services/api/.next`. Se precisar refazê-los, pare somente o host que você
iniciou e confira a saída exata e a ausência de links antes de remover arquivos
gerados. Nunca trate uma pasta de fontes ou um link como cache.

## Falha de instalação, geração ou tipos

1. Confira as versões de Node/pnpm e os `engines`/`packageManager` de
   `package.json`; instale com o lock versionado:
   `pnpm install --frozen-lockfile`.
2. Para client Prisma ausente/desatualizado, use `pnpm db:generate`, que chama
   `tools/generate-prisma-client.mjs`. Geração não aplica schema nem seed.
3. Execute `pnpm typecheck` para os projetos tipados do workspace e a suíte
   focada do assunto, conforme [testing.md](../guides/testing.md). Registre
   diagnósticos reais; não esconda erros com ignore, casts ou fonte da raiz.
4. `pnpm build:web` e `pnpm build:api` constroem os hosts respectivos. Refaça o
   build afetado depois de alterar suas fontes ou o motor de autenticação
   embutido; um build de outro host/motor não substitui essa prova.

## Banco indisponível e import no servidor

Não imprima `DATABASE_URL`, mesmo parcialmente. Identifique o alvo e o papel
autorizado pelo [manifesto](../operations/manifesto-variaveis.md). Consulte
[o diagnóstico de conexão](../guides/supabase-timeout-fix.md) e
[as leituras de isolamento](../guides/ai-database-integration.md).

O client/pool é criado preguiçosamente por `getDatabaseRuntime`, exportado por
`@gb-locacoes/backend/runtime`; a composição do host API fornece o banco às
factories do backend. A antiga `@/lib/prisma` foi retirada em F. Trocar seu
import estático por dinâmico não é uma solução atual: não recrie a fachada,
ligue Prisma ao bundle web ou adicione `$connect` em um handler por exemplo de
documentação. Sessão, vínculo e transação por tenant continuam obrigatórios.

`prisma.config.ts` lê `DATABASE_URL`. `pnpm exec prisma migrate status` consulta
esse alvo; `migrate deploy` altera schema e exige autorização e papel
apropriados. Nunca substitua migrations/RLS por `db push`, reset ou scripts
avulsos para corrigir um timeout. Prisma Studio expõe dados do alvo e não é um
teste neutro de conexão.

## Login, sessão e OAuth

Confira o motor, URL pública/interna e host do fluxo, sem compartilhar cookies
ou tokens. NextAuth é composto em `apps/services/api/src/host/session.ts`;
credenciais e limites persistentes pertencem ao módulo identity do backend.
Better Auth usa `packages/backend/src/modules/identity/factory.ts` e o contrato
de plataforma. A antiga `lib/auth.ts` foi retirada em F; suas linhas e URLs
locais antigas não são instruções para a configuração atual.

Não altere guards, scopes, flags ou cookies para absorver 401/403/503. Compare a
requisição com o contrato de host, identidade e vínculo da locadora em
[tenant-hosts-web.md](../features/tenant-hosts-web.md) e na
[ADR de identidade/hosts](../architecture/adr-tenant-hosts.md). Prova de sessão
no navegador deve usar o motor compilado e autenticação real, com ambiente e
fixture próprios; mocks unitários não certificam OAuth externo ou logout.

## Build, agenda e implantação

As definições atuais são `apps/clients/web/next.config.mjs`,
`apps/services/api/next.config.mjs` e os arquivos de deploy de cada host. O
antigo `vercel.json` da raiz foi retirado em F. A definição API declara
late-fees, expire-quotes e outbox; a web não declara crons. Não descomente uma
lista antiga, acrescente dependência genérica de Vercel ou faça upgrade/deploy
para obter verde. Limites do provedor e operação externa devem ser verificados
na etapa de infraestrutura, separada da publicação Git.

Para logs, use a composição `createApplicationLogger` de
`@gb-locacoes/backend/runtime`, com campos permitidos e redação de segredos. A
antiga `@/lib/logger` foi retirada em F. Registre contexto mínimo, operação e
código público; não copie exemplos com URLs, emails ou tokens completos.

## Storybook e visual

Siga [storybook.md](../guides/storybook.md), usando CSS público do frontend,
configuração do host web e saída fora do repo. `pnpm test-storybook` não é um
script declarado na configuração atual. Componente renderizado no Storybook não
prova sessão, dinheiro, RLS ou fluxo no host real. Captura, comparação e
aprovação humanas seguem [tests/visual/README.md](../../tests/visual/README.md).

## História preservada

Os relatos de Prisma 6/7 anterior, gerador zod, 42 erros de tipos, validações,
Swagger, OAuth e agendas Vercel do serviço global permanecem byte-exatos no
arquivo histórico citado no início. Datas, números e instruções da época não são
resultados da árvore F atual; o fechamento depende de execução consolidada dos
contratos e do relatório real do checkpoint.
