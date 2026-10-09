# ADR — Grupos de rotas do host web

Data da decisão: 2026-09-25. Estado: **substituída** por
[adr-tenant-hosts.md](adr-tenant-hosts.md) (locadora por host), implementada no
Lote 4b.

> **Nota de substituição.** A árvore descrita abaixo foi reorganizada por host,
> sem trocar as 47 URLs visíveis. O `src/proxy.ts` do host web classifica o
> `Host` e reescreve as páginas: no host de locadora para
> `(public)/[locadora]/...` (vitrine, `(auth)` e `(account)` do cliente), no
> apex para `(platform)/plataforma/...` (`/api-docs`); o painel, `/admin/login`,
> `/recuperar-senha`, `/reset-password`, `/auth/callback` e `(labs)` ficam no
> host `app`. O layout raiz continua único, mas os providers saíram dele para os
> layouts de grupo (`TenantSiteProviders`, `AppHostProviders`,
> `PlatformProviders`), e as páginas deixaram de ler o Prisma (gateway
> `host/server/public-api.ts`). O inventário por host é gerado por
> `node tools/modernization-inventory.mjs --web-routes` e conferido em
> `apps/clients/web/src/host/routing/decide.visible-routes.test.ts`. O texto
> abaixo fica como registro da decisão original.

## Contexto

O inventário real continha 47 páginas e um único layout em
apps/clients/web/src/app/layout.tsx. Não existiam layouts locais de admin ou
área do cliente nesse host. A topologia deve comunicar as áreas do produto sem
trocar URLs, duplicar telas, introduzir autorização implícita ou transformar os
hosts em uma segunda árvore de frontend.

A referência técnica lida foi
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md,
da versão instalada. Grupos entre parênteses não participam das URLs. Caminhos
duplicados entre grupos são inválidos. Múltiplos layouts raiz podem causar
recarregamento completo entre áreas.

## Decisão

Manter um único layout raiz. Organizar os arquivos existentes em (public),
(auth), (account), (admin) e (labs). Não adicionar layouts de grupo sem uma
responsabilidade concreta. Cada página continua consumindo o mesmo entrypoint do
frontend.

- (public): site, catálogo de equipamentos, orçamento, conteúdo institucional e
  referência da API.
- (auth): entrada, cadastro, recuperação, callback e /admin/login.
- (account): /area-cliente e suas rotas existentes.
- (admin): rotas administrativas, preservando o segmento /admin.
- (labs): catálogo de componentes e experimentos já existentes, inclusive
  /admin/teste-toast.

Os grupos não autorizam acesso. Sessão identifica a pessoa; recursos de uma
locadora dependem da seleção explícita e do membership revalidado no servidor. A
administração da plataforma ainda não recebeu rota ou UI inventada.

## Árvore aplicada

```text
src/app/
  layout.tsx
  (public)/       site, equipamentos, orçamento e políticas
  (auth)/         login, entrar, cadastro, recuperar-senha, reset-password
    auth/callback/page.tsx
    admin/login/page.tsx
  (account)/area-cliente/
  (admin)/admin/
  (labs)/         catalog, playground, grid-motion, equipamentos-scroll
    admin/teste-toast/page.tsx
```

## Inventário comprovado

47 páginas antes; 47 depois; nenhuma URL alterada; nenhum conflito. Foram
movidos 47 arquivos individuais. Imports relativos foram recalculados para o
mesmo destino físico. Nenhum arquivo do host legado foi movido nesta operação.

| URL preservada                    | Arquivo em src/app                                |
| --------------------------------- | ------------------------------------------------- |
| `/`                               | `(public)/page.tsx`                               |
| `/admin`                          | `(admin)/admin/page.tsx`                          |
| `/admin/categorias`               | `(admin)/admin/categorias/page.tsx`               |
| `/admin/dashboard`                | `(admin)/admin/dashboard/page.tsx`                |
| `/admin/email`                    | `(admin)/admin/email/page.tsx`                    |
| `/admin/equipamentos`             | `(admin)/admin/equipamentos/page.tsx`             |
| `/admin/equipamentos/[id]`        | `(admin)/admin/equipamentos/[id]/page.tsx`        |
| `/admin/equipamentos/[id]/editar` | `(admin)/admin/equipamentos/[id]/editar/page.tsx` |
| `/admin/equipamentos/novo`        | `(admin)/admin/equipamentos/novo/page.tsx`        |
| `/admin/financeiro`               | `(admin)/admin/financeiro/page.tsx`               |
| `/admin/login`                    | `(auth)/admin/login/page.tsx`                     |
| `/admin/logistics`                | `(admin)/admin/logistics/page.tsx`                |
| `/admin/maintenance`              | `(admin)/admin/maintenance/page.tsx`              |
| `/admin/orcamentos`               | `(admin)/admin/orcamentos/page.tsx`               |
| `/admin/orcamentos/[id]`          | `(admin)/admin/orcamentos/[id]/page.tsx`          |
| `/admin/permissions`              | `(admin)/admin/permissions/page.tsx`              |
| `/admin/rentals`                  | `(admin)/admin/rentals/page.tsx`                  |
| `/admin/settings`                 | `(admin)/admin/settings/page.tsx`                 |
| `/admin/teste-toast`              | `(labs)/admin/teste-toast/page.tsx`               |
| `/admin/whatsapp`                 | `(admin)/admin/whatsapp/page.tsx`                 |
| `/api-docs`                       | `(public)/api-docs/page.tsx`                      |
| `/area-cliente`                   | `(account)/area-cliente/page.tsx`                 |
| `/area-cliente/enderecos`         | `(account)/area-cliente/enderecos/page.tsx`       |
| `/area-cliente/historico`         | `(account)/area-cliente/historico/page.tsx`       |
| `/area-cliente/historico/[id]`    | `(account)/area-cliente/historico/[id]/page.tsx`  |
| `/area-cliente/notificacoes`      | `(account)/area-cliente/notificacoes/page.tsx`    |
| `/area-cliente/perfil`            | `(account)/area-cliente/perfil/page.tsx`          |
| `/auth/callback`                  | `(auth)/auth/callback/page.tsx`                   |
| `/cadastro`                       | `(auth)/cadastro/page.tsx`                        |
| `/catalog`                        | `(labs)/catalog/page.tsx`                         |
| `/contato`                        | `(public)/contato/page.tsx`                       |
| `/cookies`                        | `(public)/cookies/page.tsx`                       |
| `/entrar`                         | `(auth)/entrar/page.tsx`                          |
| `/equipamentos`                   | `(public)/equipamentos/page.tsx`                  |
| `/equipamentos-scroll`            | `(labs)/equipamentos-scroll/page.tsx`             |
| `/equipamentos/[id]`              | `(public)/equipamentos/[id]/page.tsx`             |
| `/grid-motion`                    | `(labs)/grid-motion/page.tsx`                     |
| `/login`                          | `(auth)/login/page.tsx`                           |
| `/orcamento`                      | `(public)/orcamento/page.tsx`                     |
| `/playground`                     | `(labs)/playground/page.tsx`                      |
| `/playground/icon-customization`  | `(labs)/playground/icon-customization/page.tsx`   |
| `/politica-devolucao`             | `(public)/politica-devolucao/page.tsx`            |
| `/privacidade`                    | `(public)/privacidade/page.tsx`                   |
| `/recuperar-senha`                | `(auth)/recuperar-senha/page.tsx`                 |
| `/reset-password`                 | `(auth)/reset-password/page.tsx`                  |
| `/sobre`                          | `(public)/sobre/page.tsx`                         |
| `/termos`                         | `(public)/termos/page.tsx`                        |

## Validação

- Inventários completos: .tmp/modernization/web-routes-before.json e
  web-routes-after.json.
- Relação de moves: .tmp/modernization/web-route-moves.json.
- Comparação ordenada das 47 URLs e detecção de duplicatas: exit 0.
- node node_modules/next/dist/bin/next typegen apps/clients/web: exit 0.
- TypeScript do host web após typegen: exit 0.

Essas verificações comprovam organização e tipagem de rotas; não comprovam
autorização, acesso a dados ou fidelidade visual. Build completo e smoke HTTP
continuam gates próprios, executados após consolidar backend e configuração de
tenancy. Rotas que ainda importam Prisma diretamente continuam uma dívida
explícita; o move não transforma essas integrações em backend isolado.

## Alternativas e consequências

Separar roots por área criaria fronteiras de recarregamento e não é necessário
aqui. Prefixos de URL novos quebrariam bookmarks e callbacks; por isso os
segmentos admin e area-cliente foram mantidos. Mover admin/login para (auth)
permite futuramente separar a composição de entrada da composição administrativa
sem redirects de autenticação circulares.

Os diretórios antigos agora vazios podem permanecer locais, mas não contêm rotas
e não entram no Git. Nenhuma remoção recursiva foi usada.

## Contrato de locadora

packages/contracts publica TenantSummary, MembershipRole, TenantContext e
OrganizationsResponse, além dos nomes x-tenant-id e selected-tenant-id. O
provider frontend exige uma seleção validada ou null explícito; não escolhe a
primeira organização e não usa User.role como autorização de recursos. GET
/api/auth/organizations é a fonte server-side dos vínculos disponíveis.
