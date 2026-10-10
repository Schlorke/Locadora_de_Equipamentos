# Guia de contribuição — Locadora de Equipamentos

O produto é um SaaS por assinatura para locadoras. Cada locadora conserva sua
vitrine, usuários, recebimentos e dados. A interface foi aceita pelo
responsável; alterações de identidade visual dependem de solicitação específica.

## Antes de alterar o projeto

Leia [AGENTS.md](AGENTS.md), [boot](docs/ai/boot.md) e
[mapa de contexto](docs/ai/context-map.md). Consulte o índice de problemas,
pesquise a ocorrência relevante em `docs/issues/known-issues.md` e leia a
documentação da funcionalidade. Antes de criar UI, confira o catálogo de
`packages/ui/src/catalog.ts` e `docs/COMPONENT_INVENTORY.md`.

As versões vigentes são as declaradas nos manifests e em `pnpm-lock.yaml`;
consulte [dependências](docs/references/dependencies.md) antes de atualizá-las.
Use Node 24 e pnpm 10.27.0. Instale com `pnpm install --frozen-lockfile` e gere
o cliente com `pnpm db:generate`. Os modelos públicos de ambiente são instruções
de configuração; não fornecem credenciais nem criam um banco hospedado.

## Onde cada responsabilidade fica

Web e mobile são hosts finos em `apps/clients/web` e `apps/clients/mobile`. O
frontend compartilhado segue FSD em `packages/frontend`; componentes e tokens
ficam em `packages/ui` e `packages/design-tokens`. Regras de negócio, contratos
e servidor pertencem a `packages/domain`, `packages/contracts` e
`packages/backend`; `apps/services/api` é o host da API.

As antigas árvores `app/` e `lib/` da raiz foram aposentadas. Uma mudança atual
deve usar o dono real no workspace, sem recriar essas fachadas. Os nomes de
pacote `@gb-locacoes/*` permanecem como contratos internos existentes; não
indicam autorização para alterar ou publicar no projeto GB-Locações.

Preserve os limites entre plataformas, camadas FSD e locadoras. Não leve Prisma,
segredos ou módulos de servidor ao cliente. Utilize componentes e tokens
existentes, sem `!important` ou cores particulares que contornem o design
system. A sequência do primeiro modelo 3D continua sujeita ao contrato de
[equipment-3d-carousel](docs/features/equipment-3d-carousel.md).

## Implementação e validação

Faça uma alteração delimitada e primeiro execute as verificações pertinentes ao
comportamento alterado. Testes devem verificar efeitos e contratos úteis; não
mantenha volume por duplicação, comparação de um host consigo mesmo ou
afirmações que apenas repetem a implementação.

Antes de concluir, execute as verificações consolidadas aplicáveis: `pnpm arch`,
`pnpm tokens`, `pnpm check:test-names`, `pnpm typecheck`, `pnpm lint`,
`pnpm lint:css`, `pnpm hygiene` e `pnpm docs:validate`, além das suítes afetadas
e de `pnpm build`. Arquitetura inválida bloqueia a conclusão. O build de
produção faz parte da validação; testes de HTTP, navegador, empacotamento móvel
e aparência não se substituem entre si.

Use banco de teste descartável próprio e aplique migrations com
`prisma migrate deploy`; não prepare a base com `db push` ou reset. Provedores
externos, produção e integrações reais exigem autorização correspondente.
Preserve logs e capturas fora do repositório e encerre somente os processos
iniciados pela sua execução. Não crie junções para compartilhar instalações.

Os testes colocados seguem o nome do arquivo testado, com `.web` ou `.native`
imediatamente antes de `.test` quando correspondem à variante da plataforma. Não
adicione exceções, ignores ou aprovações de imagem para encobrir falhas.

## Documentação e publicação

Registre causa, solução e validação na documentação da funcionalidade e nos
problemas conhecidos quando aplicável. Atualize o changelog com a data real;
documentação não deve conter credenciais. Consulte as
[diretrizes de segurança](docs/internal/documentation-security-guidelines.md).

O destino desta preparação é
`https://github.com/Schlorke/Locadora_de_Equipamentos.git`. Confira o diretório,
branch e URL de envio antes de publicar. O histórico anterior foi preservado
localmente e não deve ser enviado ao repositório público limpo. Commit e push
seguem a autorização da tarefa e as verificações concluídas; implantação,
domínio, contratação de banco e ativação de provedores pertencem à preparação
futura de infraestrutura.
