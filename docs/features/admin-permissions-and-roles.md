# Permissoes e Roles Admin

> **Status**: Critical  
> **Last updated**: 2026-10-08

---

## 1. Purpose

Definir controle de acesso consistente para evitar operacoes fora de escopo
(especialmente perfil financeiro) e remover divergencias entre schema, sessao e
guards.

## 2. Scope

**In scope**

- Roles oficiais: `ADMIN`, `FINANCIAL`, `OPERATOR`, `CLIENT`
- Guardas centralizadas para rota/API admin
- Restricao de navegacao por role no sidebar/layout
- Matriz de permissoes por modulo/acao

**Out of scope**

- Provisionamento automatico de usuarios
- Fluxo de aprovacao de acesso por gestor

## 3. Entry Points

- Identidade: `apps/services/api/src/host/session.ts` e
  `host/private-identity.ts`, sobre backend/identity. O cliente recebe o
  SessionAdapter do host; sessão autentica identidade, não substitui membership.
- Política granular:
  `packages/backend/src/modules/identity/tenant-permission.ts` e
  `apps/services/api/src/host/permissions.ts`.
- Matriz: `apps/services/api/src/app/api/admin/permissions/route.ts` (GET/PUT),
  `host/permission-rows.ts`, backend/identity/tenant-permissions-read e
  tenant-permissions-write, backend/http/permissions-write e
  `packages/contracts/src/permissions.ts`.
- Tela: `packages/frontend/src/pages/permissoes`, variantes web/native; wrapper
  web em `apps/clients/web/src/app/(admin)/admin/permissions/page.tsx`.
- Navegação: `apps/clients/web/src/app/(admin)/layout.tsx` compõe
  AppHostProviders e AdminLayoutShell. `RuntimeBootstrap.tsx` contém o
  PrivateAreaGate e chama `features/entrar-admin/model/redirect.ts`. Sidebars
  continuam em `packages/frontend/src/widgets/menu-admin`.

## 4. Core Flow

1. Sessão autentica a identidade; o principal da locadora revalida membership
   ACTIVE e organização ACTIVE a cada requisição. `User.role` não autoriza o
   acesso à locadora.
2. O portão web segue a rota e o papel do vínculo: FINANCIAL fora do financeiro
   vai para /admin/financeiro; /admin/settings só abre para ADMIN. A rota
   recusada não monta e a navegação substitui a entrada do histórico. No mobile,
   o portão recebe privateArea e não troca de rota pelo papel. A recusa de todos
   os papéis fora da equipe que o layout legado fazia não foi recriada: a API
   recusa e o menu fica vazio; conservar a decisão pendente da onda 135, sem
   prometer redirect inexistente.
3. Cada API resolve o principal e trata a falha antes de dados/efeitos. Rotas
   por allowlist comparam principal.role; por exemplo GET/PUT da matriz exigem
   ADMIN. `requireTenantPermission(request, module, action)` resolve a política
   granular: CLIENT é recusado; ADMIN da membership passa sem lookup;
   FINANCIAL/OPERATOR exigem concessão tenantId + role + module + action, em
   withTenantTransaction, sem cache ou fallback para linhas sem locadora.

As restrições de navegação por papel e os helpers de allowlist não substituem
essa política granular. Ela preserva o comportamento observado do legado: uma
concessão explícita de EQUIPMENTS/READ permite a leitura de categorias para
FINANCIAL/OPERATOR. A extração não concedeu essa permissão por padrão, alterou
menus ou ampliou acesso de um papel.

## 5. Components and Files

- `apps/services/api/src/host/private-identity.ts`, `permissions.ts` e
  `permission-rows.ts`: composição, autorização e consulta/mutação.
- `packages/backend/src/modules/identity/tenant-permission.ts` e
  `tenant-permissions-{read,write}.ts`: política e transações por locadora.
- `packages/frontend/src/pages/permissoes`: matriz e ciclo de transporte.
- `packages/frontend/src/app/providers/RuntimeBootstrap.tsx` e
  `AdminLayoutShell.web.tsx`: portão e shell, sem autoridade de banco.
- `apps/clients/web/src/app/(admin)/layout.tsx` e `admin/permissions/page.tsx`:
  wrappers finos.

## 6. Data and State

- Enum Prisma `Role`:
  - `ADMIN`: acesso total
  - `FINANCIAL`: acesso ao modulo financeiro
  - `OPERATOR`: role legado (compatibilidade operacional)
  - `CLIENT`: area do cliente
- Tabela `Permission`:
  - chave única `tenantId + role + module + action`
  - defaults sem conceder acesso administrativo amplo para `FINANCIAL`

## 7. Constraints and Edge Cases

- PUT exige ADMIN da membership, mesmo com grant USERS/MANAGE para outro papel.
  Substitui de uma só vez as concessões de FINANCIAL, OPERATOR ou CLIENT na
  locadora atual: lock transacional por tenantId + papel, deleteMany, createMany
  com skipDuplicates e leitura final. O corpo aceita de 1 a 100 entradas de um
  único papel e descarta campos extras; tenantId vem do principal. Transação,
  RLS e consultas ficam no backend compartilhado, com composição no host API. A
  montagem nos dois hosts é o registro histórico da extração.
- JSON malformado conserva 500 genérico; violações do schema conservam 400 com
  issues do Zod. A extração não introduz validação estrita, nova ordenação,
  auditoria ou notificações. A conexão única do runtime pode atrasar requisições
  concorrentes enquanto uma transação espera lock; ver known-issues 242.
- `OPERATOR` fica apenas para compatibilidade; nao e role recomendada para novos
  usuarios.
- FINANCIAL não recebe acesso amplo fora do financeiro por padrão. Nas rotas
  granulares, o backend exige a concessão explícita por locadora; restrições de
  navegação e rotas com allowlist de papéis continuam seguindo seus próprios
  contratos.
- `CLIENT` nao deve acessar qualquer rota `/admin/*`.
- Sempre validar no backend; ocultar menu no frontend nao substitui autorizacao.

## 8. Error Handling

- 401: sessao ausente
- 403: role sem permissao
- O portão web conserva os redirects FINANCIAL/settings descritos no fluxo; não
  promete o redirect de papéis fora da equipe do antigo layout.

## 9. Performance and Accessibility

- Reuso de helper unico evita duplicacao de checks e regressao
- Menu lateral filtra itens por role, reduzindo ruido de navegacao

## 10. Tests and Validation

1. ADMIN da membership atual passa no helper granular sem lookup; ADMIN global
   sem membership não autoriza acesso à locadora.
2. FINANCIAL/OPERATOR passam nas rotas granulares somente com concessão exata.
   Grants de outro tenant, papel, módulo ou ação não autorizam.
3. CLIENT é recusado por requireTenantPermission mesmo com grant armazenado.
4. Revogação de membership/concessão depois do login é observada na requisição
   seguinte. RLS exclui grants estrangeiros e sem tenant; a aplicação aplica os
   predicados adicionais de papel/módulo/ação.
5. Navegação e helpers de allowlist mantêm seus contratos próprios; paridade do
   GET administrativo não implica liberação do POST ou do menu.

## 11. Related Docs

- `docs/features/admin-system.md`
- `docs/features/admin-financeiro-page.md`
- `docs/issues/known-issues.md`

## 12. Change Log

- 2026-02-11: Padronizacao de roles e guardas com foco em isolamento do perfil
  financeiro.
- 2026-09-26 (commit `0cff7b65`): layout de `/admin/settings` exige papel
  `ADMIN` na membership da locadora selecionada; `User.role` global nao autoriza
  mais; `lib/admin-auth.ts` removido.
- 2026-09-26 (onda 2, commit `da19f601`): guarda estrutural por rota com analise
  de fluxo (secao 13).
- 2026-09-26 (onda 4, commit `4b02f52f`): formato de resultado por helper,
  `PUBLIC_TENANT_SURFACE`, dono `CLIENT` pelo parametro de rota e
  `import()`/`require()` como acesso a dados (secao 13; entrada 192 de
  `docs/issues/known-issues.md`).
- 2026-09-29 (onda 5, sem commit): guard de mesma origem central no principal e
  nos middlewares de `requireAdmin` (mutacoes do painel no host `app`) e
  passagem CSRF no inventario de rotas (secao 13; entrada 196).
- 2026-10-01 (corte 12, sem commit): composição privada compartilhada em
  `createTenantPrincipalResolver`. O inventário confere as fachadas reais e
  segue a recusa até a closure da factory; o GET de motoristas no serviço mantém
  o teste `.ok` e o papel ADMIN antes de consultar dados. O POST permanece
  legado.
- 2026-10-01 (corte 14, sem commit): política granular compartilhada por
  `createTenantPermissionResolver` e GET de categorias administrativas no
  serviço. O inventário segue as fachadas, argumentos originais, banco lazy e
  principal real até as closures; não foi acrescentada exceção pública ou bypass
  de CSRF. Caracterização anterior e paridade HTTP nos dois modos de
  autenticação estão no corte 14 de `shared-api-host.md`.

- 2026-10-01 (corte 15, sem commit): lista e detalhe de unidades físicas no
  serviço reutilizam EQUIPMENTS/READ e catalog. O export público CatalogError é
  seguido até a mesma classe da fachada, com prova de definição e de usos
  adversariais. As escritas legadas e a política de permissão não mudaram.
  Caracterização e paridade estão no corte 15 de `shared-api-host.md`.

- 2026-10-01 (corte 16, sem commit): o detalhe administrativo de equipamento
  reutiliza a mesma política EQUIPMENTS/READ, catalog e CatalogError. O
  inventário aceita o adapter sem alterações em suas regras. Paridade com
  sessões, concessões, membership e RLS reais: corte 16 de `shared-api-host.md`.

- 2026-10-01 (corte 17, sem commit): lista administrativa de equipamentos usa
  EQUIPMENTS/READ e catalog, precedidos pelo mesmo limitador em memória do
  legado. O inventário segue os exports e a factory, verifica o leitor real de
  IP e recusa imediata e rejeita I/O/async/chamadas adicionais na implementação
  compartilhada antes da identidade. Provas: corte 17 de `shared-api-host.md`.

- 2026-10-02 (corte 18, sem commit): GET /api/admin/permissions reutiliza a
  consulta compartilhada de identidade. Somente ADMIN do vínculo pode ler a
  matriz; Permission gravada para FINANCIAL/OPERATOR/CLIENT não concede essa
  administração. Filtro de tenant, role/module/action asc, DTO completo e erro
  do framework preservados. PUT e o lock de atualização continuam legados.
  Provas: corte 18 de `shared-api-host.md`.

## 13. Guarda estrutural por rota (API)

`tests/security/route-auth-inventory.test.ts` (`pnpm test:security`) examina as
árvores HTTP `apps/services/api/src/app/api/**/route.ts` e
`apps/clients/web/src/app/**/route.ts`. A varredura da antiga raiz
`app/api/**/route.ts` pertence às provas históricas anteriores à retirada; no
clone pós-F essa árvore está ausente e não fornece cobertura atual. Exige, para
cada metodo exportado, uma destas saidas:

- **Helper aprovado (`GUARDS`)** cujo resultado seja retornado ou testado com
  saida (`return`/`throw`) em todo caminho, antes de qualquer acesso a dados ou
  efeito. Helpers: `requireTenantPermission`, `resolveTenantPrincipal`,
  `requireAdmin`, `requireAdminOrOperator`, `requireRoles`,
  `requireFinancialAccess`, `requirePermission`; `authenticateTenantWebhook` so
  em webhooks; `requireCronAuthorization` e `runTenantCron` so em `/api/cron`;
  `resolvePublicTenant` e `resolvePublicRequestTenant` so nos metodos de
  `PUBLIC_TENANT_SURFACE` (abaixo); `getServerSession`, `handleIdentityRequest`
  e o NextAuth so em `/api/auth`. `getIdentity` nao autentica e nao conta.
- Cada helper de `GUARDS` declara o formato do resultado (onda 4), e so conta o
  teste que separa negado de autorizado:
  - `discriminated`: objeto sempre presente; so o booleano `ok` ou `success`
    (`if (!access.ok) return access.response`); `!auth` ou
    `auth.success === undefined` nao autorizam;
  - `denial`: `Response` de negacao ou `null` para seguir
    (`if (denied) return denied`);
  - `nullable`: o valor ou `null` (`if (!session?.user?.id)`);
  - `response`: handler delegado; sucesso so por `.ok` ou status 2xx;
  - `opaque`: so o retorno direto conta. Um self-check confere esses formatos
    contra o codigo dos helpers.
- **Entrada no `PUBLIC_ALLOWLIST`** com justificativa e invariante verificada:
  catch-all 404, `health`, `drei-proxy`, rotas aposentadas (410) e os fluxos
  anonimos de identidade (cadastro, recuperacao, redefinicao e verificacao de
  e-mail, invariante `IDENTITY_FLOW`: so modulos de plataforma, nunca dados de
  locadora).

Padroes aceitos: `if (!access.ok) return access.response`,
`if (!auth.success) {...}`, `if (denied) return denied`, `return denied ?? ...`,
`access.ok ? ... : access.response`, `if (!context) return 404` e
`if (!session?.user?.id)`. So as chamadas de `PRE_AUTH` podem vir antes da
guarda (`next/server`, `zod`, `decimal.js`, `isTrustedMutationOrigin`,
`identityMode`, o limitador em memória de
`apps/services/api/src/host/rate-limit.ts` e as factories de resposta
explicitamente cadastradas em PRE_AUTH); qualquer outra chamada importada conta
como acesso a dados. As fachadas `lib/rate-limit` e `lib/api-response` eram o
endereço histórico antes da retirada da raiz, não imports para novos handlers.
Um bloco `catch` e avaliado a partir do estado anterior a guarda.

Em `/api/admin`, `resolveTenantPrincipal` so autoriza depois de comparar o papel
do principal com uma allowlist de papeis de equipe (`ADMIN`, `FINANCIAL`,
`OPERATOR`, sincronizada com o enum `Role`) e sair em caso de falha, antes de
qualquer acesso a dados. Exemplo: `if (principal.role !== 'ADMIN') return 403`.
Tambem valem predicados (`canManageContracts`), delegados que checam o papel
antes do proprio acesso (`generateRentalContract`) e os helpers
`requireRoles`/`requireTenantPermission`. `CLIENT` so e aceito quando
`principal.userId` e comparado com o parametro de rota que nomeia o recurso (um
`const` vindo de `await params` no handler exportado) e esse mesmo valor vai
para o acesso a dados seguinte (padrao de `admin/clients/[id]/documents`).
`principal.userId === principal.userId`, `=== body.userId`, parametro de query,
`let` reatribuivel ou parametro que nao chega ao acesso nao contam. Ler `.role`
de payload ou de resultado de consulta, lista de negacao (`=== 'CLIENT'`) e
checagem depois do acesso tambem nao contam.

`PUBLIC_TENANT_SURFACE` (onda 4) e a allowlist dos 12 metodos publicos por
locadora que podem se apoiar em `resolvePublicTenant` ou
`resolvePublicRequestTenant`, cada um com motivo: GET de `categories`,
`equipments`, `equipments/[id]`, `equipments/[id]/availability`,
`equipamentos/search`, `settings/public`, `public/tenants/[slug]` e
`auth/organizations/current`; POST de `contact`, `quotes`, `orcamentos` e
`client/enroll`. Fora dela, a resolucao publica nao autoriza; o teste reprova
entrada obsoleta ou sob `/api/admin`.

Carregar modulo com `import()` ou `require()` (desestruturado, namespace ou
encadeado) conta como import estatico, e `globalThis`/`self`/`window.fetch`
conta como I/O: nada disso pode vir antes da guarda.

O inventario cobre `export const { GET } = ...`, `export { x as GET }`,
`export { GET } from` e `export * from` (seguido recursivamente). Formas nao
resolviveis (desestruturar resultado de chamada, `export let`, `export *` de
pacote) falham de proposito.

Passagem CSRF (onda 5, entrada 196 de `docs/issues/known-issues.md`): com as
mesmas regras de fluxo, toda mutacao autenticada por cookie precisa passar pelo
guard de mesma origem (`rejectCrossOriginMutation`/`isSameOriginMutation`, que
podem vir antes da guarda, como `isTrustedMutationOrigin`) antes de qualquer
efeito. O teste confere no codigo que os helpers centrais carregam o guard: a
recusa de origem no resolver compartilhado de principal, alcançado por
`host/private-identity.ts`. Os middlewares antigos de requireAdmin com method:
null eram parte da caracterização legada; os adapters atuais seguem a mesma
obrigação antes de efeito. A navegação não substitui CSRF. Duas listas exatas,
que reprovam entrada obsoleta: `OWN_CSRF_DEFENCE` (NextAuth e Better Auth, com
defesa propria) e `CSRF_PENDING` (vazia).

Após o corte 14, requireTenantPermission só conta quando a composição das
fachadas delega o Request, módulo e ação originais ao resolver aprovado. A
factory precisa resolver o principal real e retornar a falha antes de consultar
permissões; a prova continua até a recusa de mesma origem e os leitores reais de
sessão/banco do principal. O formato discriminante é conferido no código
compartilhado. Casos adversariais rejeitam sucesso forjado, factory/dependências
trocadas, argumentos alterados, consulta antecipada e `.ok` ignorado. A factory
não faz I/O ao ser criada. O escopo novo do helper no serviço é somente
`/api/admin/**`; nenhuma allowlist pública ou proteção existente foi relaxada.

---

## Atualização de permissões no serviço (onda 54, 2026-10-02, sem commit)

Registro histórico da onda 54: PUT foi composto nos dois hosts sobre o mesmo
schema, transação e advisory lock. 41 caracterizações antes e 82 depois, mais 30
regressões da leitura existente; paridade HTTP nos dois motores, rollback SQL e
concorrência entre hosts. O inventário rejeita remoção da guarda ADMIN em ambos
os adaptadores. A API legada segue ativa e o pool anterior foi preservado.
Evidências, contagem atual e limites na
[onda 54 da API compartilhada](shared-api-host.md).

## Ciclo do consumidor (onda 70, 2026-10-03, sem commit)

GET/PUT usam adapter privado da página permissoes sobre HttpClient. PUT conserva
somente o perfil selecionado; trocar perfil durante rede descarta feedback e
releitura antigos. Wrappers web/native reiniciam por identidade/transporte;
matriz ADMIN, estilos e autorização do servidor não mudaram. Provas de
transporte/ corpo/ciclo: [onda 70](shared-api-host.md). Bundle não certifica uso
em aparelho.

## Consumidor Expo (onda 83, 2026-10-03, sem commit)

A apresentação nativa existente tem 45 escolhas, ADMIN desabilitado e gravação
exclusiva do papel selecionado. Testes renderizam Checkbox nativo e comprovam
payload, 403 sem sucesso e reinício do perfil em outro contexto. Wrappers
web/native consideram também status da organização; autorização real permanece
no backend. Rota só compõe a página, sem rolagem duplicada, e dashboard abre o
destino implementado. Provas e limites: [onda 83](shared-api-host.md); uso em
aparelho não certificado.

## Sementes do cadastro assistido (onda 112, 2026-10-04, sem commit)

O onboarding grava a matriz inicial histórica documentada, usando somente INSERT
sob a locadora nova: FINANCIAL lê/escreve FINANCIAL; OPERATOR lê QUOTES e
RENTALS; CLIENT lê RENTALS, QUOTES e CONTRACTS. São sete linhas de Permission
por organização. ADMIN continua implícito. Linhas CLIENT não contornam a
proibição do principal na área administrativa. Nenhuma permissão de organização
existente é alterada. `modules/onboarding/seeds.ts` permanece compartilhado e o
papel `platform_runtime` não recebe SELECT nas tabelas de sementes. Provas de
transação/isolamento: [onda 112](shared-api-host.md).
