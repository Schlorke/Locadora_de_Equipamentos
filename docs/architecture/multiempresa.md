# Plataforma de locação: isolamento entre locadoras

## Decisão de produto

O usuário confirmou que o produto deste clone atende várias locadoras
independentes. GB-Locações é a origem do legado, não a identidade definitiva da
plataforma. Repositório informado:
https://github.com/Schlorke/Locadora_de_Equipamentos. O remote local ainda
aponta para o projeto anterior; esta entrega não altera nem publica Git.

Esta decisão substitui a premissa inicial de operação única. Não implica
marketplace público, assinatura comercial, novos provedores ou sincronização
offline.

## Identidade e autorização

User representa uma identidade global. Membership define o papel dessa
identidade dentro de uma Organization. Cada requisição privada valida sessão,
vínculo ativo e organização ativa; User.role legado não autoriza recursos de
outra locadora. Não existe seleção automática da primeira organização. O cliente
informa a seleção, mas apenas o servidor concede acesso.

ClientProfile guarda o cadastro comercial de cada locadora. Dados pessoais no
User legado exigem classificação e migração explícita antes de serem expostos
por módulos multiempresa. Administrador de uma locadora não é administrador da
plataforma.

## Dados e execução

Recursos de negócio recebem tenantId. Consultas e escritas usam contexto
explícito e transação com app.tenant_id local. Políticas PostgreSQL RLS,
inclusive FORCE, ocultam registros fora do contexto. Chaves estrangeiras
compostas impedem vínculos entre equipamentos, itens, orçamentos, pagamentos e
locações de organizações distintas. A role de runtime não pode ser superuser nem
BYPASSRLS.

Campos tenantId do legado são inicialmente opcionais para expansão segura. Valor
nulo significa registro não atribuído, inacessível pela RLS. Não significa
organização padrão. Nenhum backfill atribui automaticamente os dados históricos
à GB ou a uma nova empresa.

Sessões, identidades, vínculos e metadados mínimos de roteamento de integrações
são globais por responsabilidade. As APIs filtram vínculos pelo usuário
autenticado. Um registry contém somente identificadores de integração e recurso;
valores de cobranças e documentos permanecem no escopo da locadora.

Integrações autenticam o callback pelo vínculo configurado antes de resolver o
recurso. Chaves globais do legado não servem como fallback para locadoras. Jobs
percorrem organizações ativas e processam cada escopo separadamente. Outbox
guarda tenantId e deduplica por locadora; reserva de estoque também serializa
por locadora.

## Resolução por host

Decisão de produto do usuário em 2026-09-26: cada locadora tem um subdomínio da
plataforma (`{slug}.<raiz>`), o painel da equipe fica em `app.<raiz>`, existe um
único app mobile e o nome provisório da plataforma fica num lugar central
(`packages/contracts/src/platform.json`).

Na web, a locadora vem somente do cabeçalho Host. Query, corpo, header ou cookie
com outra locadora é conflito, nunca escolha. Locadora desconhecida, suspensa ou
reservada recebe o mesmo 404. O painel continua exigindo seleção explícita e
membership revalidado no servidor.

O contrato (`@gb-locacoes/contracts/platform`: política de slug, subdomínios
reservados, classificação de host, ambiente e origens) e o plano em lotes estão
em `docs/architecture/adr-tenant-hosts.md`.

### Estado dos lotes (2026-09-26)

Lotes implementados só na árvore de trabalho (onda 2, sem commit):

| Lote | Entrega                                                                                                     | Provas registradas                                                             | Documento                                    |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| 0    | Contrato `platform.json`/`platform.ts`/`directory.ts`, ADR e variáveis `PLATFORM_*`                         | T1 (tabela com 128 casos) e T2 (varredura real das rotas e de `public/`)       | `adr-tenant-hosts.md`                        |
| 1    | `serializeJsonLd` nos três pontos de JSON-LD                                                                | T12 só na parte do escape                                                      | `docs/features/structured-data-json-ld.md`   |
| 2    | Borda validada, `resolvePublicRequestTenant`, candidatas no principal, rotas públicas novas, cache por host | T7 e T8                                                                        | `docs/features/tenant-request-resolution.md` |
| 3    | CHECK `organizations_slug_dns_label` e `pnpm tenant:slug-preflight`                                         | CHECK real contra a matriz do contrato; preflight que aborta sem alterar dados | `docs/features/tenant-slug-policy.md`        |
| 4a   | Modo host do frontend, `useVisiblePathname`, `PrivateAreaGate`                                              | Hidratação com caminho interno x visível; navegador real do expo-router        | `docs/features/tenant-hosts-web.md`          |
| 4b   | Proxy puro, árvore por host, providers por grupo, gateway server-only                                       | T3, T4, T15, T5/T16 em `next start`, T6 com papel superuser                    | `docs/features/tenant-hosts-web.md`          |

Pendentes: Lote 5 (SEO por host e T12 completo), 6 (identidade multi-host), 7a
(diretório e rate limit persistente), 7b (mobile e deep link), 7c (diretório no
apex), 8 (staging multi-host), 9 (ISR), 10 (limpeza da compatibilidade), 11
(domínios próprios) e 12 (corte da GB). Decisões do usuário ainda abertas: U1 a
U5 da ADR (domínio e DNS, confirmação do painel em `app.`, design do apex e da
tela de vínculo com texto LGPD, bundle/package/Team ID/fingerprint e páginas
legais por locadora).

### Fechado na onda 2

- A locadora da web vem só do Host: o proxy remove `x-platform-*` recebidos,
  recalcula a borda e remove o cookie `selected-tenant-id` em host de locadora;
  o backend revalida o segredo (atual e anterior, em tempo constante) e a origem
  com `classifyHost`. Borda forjada, `x-tenant-id` e cookie de B no host de A
  não dão acesso a B (T7).
- Conflito entre host, query, corpo, caminho, header ou cookie responde 400
  antes de qualquer leitura; locadora desconhecida, suspensa, reservada ou
  inválida recebe 404 idêntico em status, cabeçalhos e corpo (T8).
- Equipamento de outra locadora no detalhe público e no host dá 404; o cartão
  público não expõe CNPJ, telefone, e-mail, CEP nem endereço.
- `/api/auth/organizations/current` cita só a locadora do host (V26).
- Respostas públicas no host de locadora usam só cache de navegador com
  `Vary: Host`; `GET /api/quotes` é `private, no-store`.
- Slug de locadora obedece a rótulo DNS no banco (CHECK) e a lista de reservados
  tem uma só fonte (`platform.json`).
- Jobs `expire-quotes` e `auto-convert-quotes` filtram `tenantId` além do RLS.
- As páginas do host web não importam Prisma; leem as APIs públicas do legado
  pelo gateway server-only.

### Violações e pendências remanescentes

- **Identidade**: o `RuntimeBootstrap` ainda usa `/api/auth/organizations` e
  `/selection`, negados no host de locadora (Lote 6); em área privada a locadora
  efetiva ainda é a da seleção. Em `AUTH_MODE=legacy` não há login de cliente em
  subdomínio (R3). `/auth/callback` no host `app` leva a páginas que não existem
  ali.
- **Limitador de autenticação** em memória, por instância, até
  `platform_rate_limits` (Lote 7a); deve passar a usar
  `PLATFORM_RATE_LIMIT_SECRET` e `edge.clientIp`. Fora da Vercel, sem
  `TRUSTED_PROXY_HOPS`, não há janela por IP.
- **Enumeração** de CPF/CNPJ pelo efeito do cadastro (login não exige e-mail
  verificado) e contas que diferem só pela caixa (negadas até unificação):
  decisões de produto.
- **SEO**: `robots.txt`, `sitemap.xml` e `manifest.json` respondem 404 no host
  de locadora e no apex; JSON-LD e metadados ainda usam os padrões da GB (Lote
  5).
- **Provas incompletas**: T6 rodou com papel superuser/`BYPASSRLS` (isolamento
  pelos filtros e pela borda, não pelo RLS); T16 só em `next start` (R1 na
  Vercel); `images.localPatterns` (R9) não aplicado.
- **Contrato HTTP**: 404 neutro sem `code` no corpo e 409 com corpo por rota; a
  checagem de `Origin` em `POST /api/quotes` e `/api/contact` só vale com borda.
- **Backend**: `admin/quotes/[id]/pdf-oficio` e
  `admin/rentals/[id]/client-documents` ainda leem o banco direto (dependem do
  módulo documents).
- **Compatibilidade**: `?tenantSlug` na navegação web e
  `sessionStorage['public-tenant-slug']` continuam até o Lote 10; seis widgets
  ainda importam `usePathname`.
- **Testes**: fixtures que gravam slug com `_` quebram com o CHECK novo
  (known-issues 158).

## Migração e limites atuais

As migrations foram produzidas a partir do schema local. Aplicação em banco
existente exige comparação com o catálogo real, diagnóstico de duplicidades,
atribuição aprovada dos registros e ensaio de restauração. Não aplicar a
baseline em produção sem esse preflight.

A fundação multiempresa não certifica migração de todos os endpoints: módulos
que ainda usam consultas globais, credenciais antigas, constraints globais,
caches sem tenant e cadastros User legados continuam pendentes e bloqueiam
publicação. O arquivo tools/tenant-models.json registra a classificação dos
modelos; qualquer modelo novo deve ser classificado.

Regras de migration registradas nas ondas 1 e 2:

- O papel de migração pode ser dono das tabelas sem `BYPASSRLS`. Preflight de
  dados em tabela com `FORCE ROW LEVEL SECURITY` suspende e restaura o `FORCE`
  dentro do mesmo bloco `DO` (padrão em `docs/features/tenant-slug-policy.md`,
  seção 9) e ganha caso em `tests/unit/migration-preflight-rls.test.ts`.
- Comportamento medido do Prisma 7.10 (schema-engine nativo): script com `$$`
  roda numa transação implícita; script sem `$$` é executado instrução por
  instrução, sem atomicidade.
- Preflights abortam sem alterar dados; `NULL` nunca é inferido.
- Valor novo de enum (`ADD VALUE`) exige migration separada da que o usa.
- Índices parciais existem só em SQL (`rentals_tenant_quote_unique` e
  `payments_quote_method_type_active_unique`, comentados no `schema.prisma`;
  `addresses_one_primary_per_tenant_user`, na migration `202609250013`); nunca
  aceitar `DROP` gerado por `migrate diff`.
- `organizations` é modelo global (sem RLS); a migration `202609260005` aborta
  se isso mudar. Antes de cada deploy com migrations, rodar
  `pnpm tenant:slug-preflight` contra o banco de destino.

## Critérios de aceitação adicionais

- Mesmo usuário com acesso a duas locadoras recebe os papéis corretos em cada
  uma.
- Revogar um vínculo impede a próxima operação, preservando os demais vínculos.
- Contexto ausente, adulterado ou conflitante não produz acesso implícito.
- Leituras, mutações, exports, documentos, storage, cache, eventos e
  notificações não atravessam locadoras.
- Estoque e locks de uma locadora não restringem os da outra.
- Runtime PostgreSQL sem bypass comprova RLS e rejeita FKs cruzadas.
- Nenhum dado legado sem atribuição aparece nas interfaces multiempresa.
