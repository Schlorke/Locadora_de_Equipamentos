# AI Context Boot

Goal: load the smallest set of documents that still gives correct context.

## Mandatory Reading Order

1. `AGENTS.md`
2. `docs/ai/context-map.md`
3. `docs/issues/known-issues.index.md` (then search
   `docs/issues/known-issues.md`)
4. `docs/features/<component-or-page>.md` (or create it from the template)
5. `docs/COMPONENT_INVENTORY.md` + `packages/ui/src/catalog.ts`

## Context Budget Rules

**Decisão humana de 2026-10-09:** interface atual aceita; revisar a utilidade
dos testes, validar a primeira etapa e publicar somente no origin
`Schlorke/Locadora_de_Equipamentos`. Continuar o plano de retirada local da raiz
com provas e checkpoint completos. Banco hospedado, escolha dos serviços,
produção e corte do projeto GB-Locações ficam para depois. O aceite e a nova
autorização prevalecem sobre bloqueios históricos do handoff. Cadência focada
durante edição e consolidada no fechamento em `docs/guides/testing.md`.

**Decisão humana de 2026-10-02 — cadência de validação:** implementar ondas
maiores e relacionadas, com os testes necessários consolidados ao final da onda.
Não repetir suítes completas por handler ou ajuste. Preparar as provas e
preservar contratos durante a implementação; só declarar a onda validada após a
execução final. Não remover o legado, publicar ou alterar produção sem as provas
e autorizações já exigidas. Esta decisão substitui a cadência anterior de
executar testes a cada corte pequeno.

- Prefer indexes and maps before opening large files.
- Use `rg -n "keyword" docs/issues/known-issues.md` to open only relevant
  sections.
- Summarize what you learned before writing code.
- Do not load full documents when a targeted section is enough.

## Conflict Resolution

- When docs conflict, follow `AGENTS.md` and this file.
- Package manager: use `pnpm` (repo uses `pnpm-lock.yaml`).

## Documentation Triggers (After Changes)

- Bugfix: update `docs/issues/known-issues.md` and its index.
- Feature/component change: update `docs/features/<component>.md`.
- Process/tooling change: update `docs/ai/` and any related guides.
- Always update `CHANGELOG.md` using the real date from:
  `git log --pretty=format:"%h %ad %s" --date=short`.

## Security

Never expose real credentials in docs. Follow:
`docs/internal/documentation-security-guidelines.md`.

## Regras permanentes do usuário (2026-09-26)

- **Produto**: plataforma SaaS por assinatura. Locadoras assinam; a receita é só
  a mensalidade; Asaas com uma subconta por locadora; painel em `app.<raiz>` e
  vitrine em `{slug}.<raiz>`. ADRs: `docs/architecture/adr-saas-subscription.md`
  e `docs/architecture/adr-tenant-hosts.md`.
- **`!important` é proibido** em CSS, no Tailwind (modificador `!` como prefixo
  ou sufixo) e em estilo inline. Use `@layer`, variantes no componente ou a
  configuração da biblioteca. A regra `css-important` do `pnpm tokens` bloqueia
  qualquer ocorrência no código, sem baseline de tolerância. As ocorrências
  antigas foram retiradas nas ondas 3 a 5; a entrada 177 descreve uma etapa
  histórica. Refatoração de CSS exige a linha de base visual
  (`tests/visual/README.md`).
- **Nome de teste colocado**: `<assunto>.test.ts(x)` ou
  `<assunto>.<aspecto>.test.ts(x)`, com `.web`/`.native` logo antes de `.test`
  (por exemplo `RuntimeBootstrap.ssr.web.test.tsx`). O nome precisa aninhar sob
  o arquivo testado no Explorer (`explorer.fileNesting` de
  `.vscode/settings.json`). `pnpm check:test-names`
  (`tools/test-colocation-check.mjs`, job `architecture` do CI) reprova teste
  órfão; exceção só em `tools/test-colocation-allowlist.json`, com motivo de 8
  ou mais caracteres, e a lista só encolhe. `tests/` da raiz fica de fora.
- **Ambiente compartilhado**: nunca criar junção/symlink para dentro do
  repositório nem rodar remoção recursiva em pasta que possa conter links
  (entrada 171 de `docs/issues/known-issues.md`). `node_modules` quebrado se
  resolve com `pnpm install --force`, nunca apagando a pasta (seção "Limpeza
  segura" de `docs/getting-started/troubleshooting.md`); o pre-commit formata só
  o Markdown preparado e re-adiciona só o que ele mesmo mudou (entrada 227).

_Last updated: 2026-10-02_

Instalação em sandbox: conferir store-dir e node_modules/.modules.yaml antes de
pnpm install. A entrada 237 registra store local com junção à raiz; nunca apagar
recursivamente pastas com links ou aceitar recriação de node_modules sem avaliar
o destino. Não esconder o problema com ignore de artefatos.

## Modernização em curso

Aceite operacional local da API: onda 59 de docs/features/shared-api-host.md e
docs/guides/shared-api-acceptance.md. Multipart/PDF/OAuth/cache/jobs e HTML SSR
aprovados nos dois motores; operação externa, aparelhos e retirada de app/
continuam pendentes. Não confundir inventário montado com conclusão geral.

A decisão posterior é multiempresa. Leia `docs/architecture/modernization.md` e
`docs/architecture/multiempresa.md` antes de tocar APIs, dados ou autenticação.
`pnpm db:generate` gera somente Prisma Client, sem reescrever contratos
públicos. Testes de banco exigem `TEST_DATABASE_URL` local descartável e
`TEST_DATABASE_DISPOSABLE=true`; identidade usa as mesmas variáveis. Nunca use
`db push` para substituir migrations com RLS/triggers. `pnpm tenant:check` faz
leitura explícita de `TENANT_RUNTIME_DATABASE_URL` e rejeita runtime com
bypass/ownership.

Seleção multiempresa: consultar `docs/features/organization-selection.md`; não
escolher a primeira locadora automaticamente.

Estado das ondas, gates e pendências: `docs/architecture/modernization.md`.
Checkpoints locais: ondas 1 a 4 em `0cff7b65`, `da19f601`, `be859915` e
`4b02f52f`; ondas 5 a 9c incorporadas em `55763c1e` (2026-09-30). O
[handoff Claude → Codex](claude-codex-handoff-2026-09-30.md) registra a
cronologia, a conferência dos logs e a retomada da validação. Notificação de
comando concluído não certifica que suas suítes passaram: confira cada exit.

A decisão de 2026-09-30 é uma API compartilhada em `apps/services/api`,
consumida pelos dois clientes, mantendo o monólito modular em
`packages/backend`. Categories/health, equipamentos/busca/settings públicos,
disponibilidade, detalhe, cartão da locadora, busca do diretório e leitura
autenticada de vínculos, seleção e vínculo do host
(`GET /api/auth/organizations`, `/selection` e `/current`) e listagem privada de
motoristas (`GET /api/admin/drivers`), endereços (`GET /api/addresses`) e
categorias administrativas (`GET /api/admin/categories`) e unidades físicas
(`GET /api/admin/equipment-units` e `/[id]`) e detalhe administrativo de
equipamento (`GET /api/admin/equipments/[id]`) e lista
(`GET /api/admin/equipments`) e permissões administrativas
(`GET /api/admin/permissions`, ADMIN do vínculo) e perfil comercial
(`GET /api/user/profile`, ownership por usuário/locadora) e notificações
(`GET /api/client/notifications` e `/stats`, PATCH/DELETE de `[id]` e POST
mark-all-read) foram instalados localmente; o serviço ainda é parcial e
`app/api` é o runtime HTTP legado configurado para clientes/jobs. A referência
atual é a
[ADR de extração do backend](../architecture/adr-backend-extraction.md). Estado
e comandos: [host compartilhado](../features/shared-api-host.md).

A composição de identidade usa as factories `createApplicationSessionReader`,
`createLegacyAuthentication` e `createIdentityRuntime` de backend/identity.
Fachadas da raiz continuam com leitores Next, Prisma, Resend e limitadores
reais. O serviço já lê sessões nos dois modos para listar vínculos e retomar a
preferência validada e o vínculo da locadora do host. Desde a onda 55, também
compõe GET/POST dos motores NextAuth e Better Auth e POST/DELETE da seleção,
usando as mesmas factories e políticas do backend. A paridade local inclui
cookies emitidos pelo serviço e consumidos pelos dois hosts. A onda 56 compõe os
quatro fluxos auxiliares de credenciais por factories únicas de identity/http,
com schemas em contracts/credentials. A onda 57 compõe os nove jobs restantes:
149 rotas/193 métodos nos dois hosts, sem scheduler adicional. A autenticação, o
runner de tenant, as regras dos jobs e os efeitos da outbox são únicos no
backend. HTTP local de ambos os modos passou; o inventário igual não certifica
cutover, SaaS, paridade mobile ou retirada da raiz. A onda 58 permite ensaio
local dos consumidores: public/ pertence ao web, Expo separa a origem dos
arquivos, e proxy/login/seleção/CSRF/rollback de sessão passaram contra os dois
destinos e motores. Exemplos próprios permitem escolher 3002, mantendo 3000 para
rollback; ambientes reais, callbacks, flags de auth e scheduler não mudaram.
Instalar o substituto não é realizar cutover. O inventário de autorização cobre
os três hosts.

Limitadores persistentes de identidade ficam em `identity/rate-limit.ts`
(`createIdentityLimiters`/`createLegacySignInGuard`), e-mail em
`identity/mail.ts` e transporte Resend em `runtime/mail.ts`. As fachadas da raiz
conservam as dependências reais. Limitadores genéricos em memória usam
`createMemoryRateLimiters` de backend/http, com stores por escopo/composição e o
leitor real de IP; as fachadas preservam a ordem limite → permissão → consulta.
A resolução privada do principal é compartilhada por
`createTenantPrincipalResolver`: sessão real, preferência, borda e vínculo são
revalidados por requisição; o guard de mesma origem é o primeiro passo da
closure. Papéis/permissões continuam visíveis nos adapters. O serviço instala os
GETs privados, três mutações de notificações, três de endereços, duas do
carrinho (mais sua leitura), o PUT do perfil comercial, POST administrativo de
motoristas e categorias e POST de vínculo explícito do cliente com a locadora já
caracterizados; os demais writes continuam legados. A política granular é
composta por `createTenantPermissionResolver`, que revalida o principal e a
Permission exata por locadora, papel, módulo e ação. ADMIN do vínculo dispensa
lookup de permissão; CLIENT nunca é admitido por esse helper. O inventário segue
a delegação até o principal real. PUT/DELETE de categorias por id também estão
compostos, com WRITE ou DELETE e posse antes de ler o corpo. O serviço tem 24
GETs e dezoito mutações no corte 32. A onda 33 acrescenta PUT/DELETE de
equipamentos, GET/POST de veículos e GET/POST/PATCH de logística: 26 GETs e 23
mutações em 33 rotas. A onda 34 compõe portal de locações, pedidos locais e
consultas de orçamentos: 31 GETs e 27 mutações em 40 rotas, ainda parcial.
Factories existentes em rentals/quotations; schema estrito de prazo comum em
contracts/rental-requests. A onda 35 compõe o ciclo administrativo de locação,
prorrogação do cliente, lista de orçamentos e atividades: 35 GETs e 35 mutações
em 49 rotas. Schemas comuns em contracts/rentals; queries em
quotations/customers; regras, lock, dinheiro e outbox no backend existente.
Cliente, emissão externa de pagamentos e scheduler continuam no legado.
Veículos/entregas compartilham operations e os schemas legados em
contracts/operations. POST de unidades físicas também está composto, usando
catalog/createUnit e o schema legado comum em contracts/equipment-units (corte
30). PATCH/DELETE por id usam updateUnit e deleteUnit, com WRITE/DELETE e schema
de atualização comum; RENTED/RESERVED impedem exclusão (corte 31).

POST de equipamentos também composto (corte 32): limiter antes de
EQUIPMENTS/WRITE, criação em catalog/createEquipment com categoria da locadora,
lock, normalização e DTO existentes. Sem alteração do legado ou de cliente.

Leitura de notificações pertence a backend/communications; o parser público de
query fica em contracts/notifications. O legado delega à mesma consulta e mantém
validação dentro da transação. Filtros do total/página não restringem as
estatísticas de não lidas. GET /stats usa uma consulta compartilhada distinta:
total da caixa e não lidas por tipo/prioridade, sem filtros da listagem. Ver
docs/features/notification-system.md.
