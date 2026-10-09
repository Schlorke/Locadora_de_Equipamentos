# Plano de migração — contrato de plataforma

Data: 2026-09-25. Estado: **bloqueado**. Nenhum `package.json` novo foi criado.

Escopo npm proposto: `@gb-locacoes`.

[INFORMATION_NEEDED: npm_scope]

A Fase 1 (esqueleto) só começa depois da confirmação desse escopo. Esta fase não
altera código de produto, schema, preço, status, permissão, texto legal, e-mail,
webhook nem URL.

## O que o repositório é hoje

Fonte lida: `package.json`, `pnpm-workspace.yaml`, `prisma/schema.prisma`,
`app/`, inventário `legacy-inventory.mjs` em 2026-09-25.

| Peça    | Observado                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App     | Next.js **16.1.6**, App Router, um único pacote na raiz (`gb-locacoes`)                                                                                                        |
| UI      | React **19.2.4**, Tailwind **3.4.17**, Radix, CVA                                                                                                                              |
| Dados   | Prisma **7.4.1**, `@prisma/adapter-pg`, PostgreSQL, Zod **4.3.6**                                                                                                              |
| Auth    | NextAuth **4.24.13**. Roles no schema: `ADMIN`, `FINANCIAL`, `OPERATOR`, `CLIENT`                                                                                              |
| Estado  | Zustand **5.0.11** (`stores/useCartStore.ts`)                                                                                                                                  |
| Testes  | Vitest (`pnpm test`), Playwright presente. Cobertura percentual não medida                                                                                                     |
| Pacotes | pnpm. `pnpm-workspace.yaml` lista pastas de código (`app`, `components`, `hooks`, `lib`, `middlewares`, `prisma`, `schemas`, `types`, `tests`), não pacotes com `package.json` |
| Mobile  | Ausente (`expo: false`, `react-native: false`)                                                                                                                                 |

`AGENTS.md` ainda cita Next 16.0.3, Prisma 7.1.0 e NextAuth 4.24.11. A versão
que vale para esta migração é a do `package.json`. Não atualizar nem rebaixar
dependências nesta migração.

## Inventário do script

Comando:
`node .agents/skills/legacy-code-refactoring/scripts/legacy-inventory.mjs --root <repo> --json`.
Exit 0.

O script varre o disco inteiro, inclusive cópias das skills. Leitura de produto
abaixo exclui `.agents/`, `.claude/` e `.cursor/`.

- Arquivos de código no relatório bruto: 3599.
- Topologia ausente: `apps/clients/web`, `apps/clients/mobile`,
  `packages/frontend`, `packages/ui`, `packages/design-tokens`.
- Pastas por tipo no produto: `components`, `hooks`, `lib`, `types`,
  `tests/components`, `tests/helpers`.
- `lib/` concentra a contagem (2883 arquivos no mapeamento). A maior parte é
  `lib/validations/schemas/**`, gerado pelo Prisma/Zod. Não é UI e não entra em
  FSD.
- Rotas `page.tsx` de produto: 46 (lista abaixo).
- Literais `#rrggbb` fora de `design-tokens`: 74 arquivos. A lista completa fica
  no JSON do script; a fatia de tokens relê antes de mover.
- Proposta automática do script para `components/`: só nomes genéricos
  (`Button`, `Input`, `Text`, `Stack`, `Box`, `Modal`, `Card`, `Icon`, `Link`)
  vão para `packages/ui`. O resto cai em entity/widget. `components/ui/` mistura
  os dois; cada arquivo é relido na fatia, não movido em bloco.

## Desacordo com o contrato

O alvo continua sendo o contrato. O repositório, hoje, discorda dele:

1. Um app Next na raiz, sem hosts finos e sem `packages/frontend`.
2. `design-tokens/` na raiz (Style Dictionary: `base.json`, CSS e JSON
   Tailwind), não `packages/design-tokens` em TypeScript com camadas primitiva,
   semântica e de componente.
3. `pnpm-workspace.yaml` não descreve um monorepo de pacotes. A Fase 1 troca
   essa lista pela topologia real, sem apagar `app/`.
4. `components/ui` não é um pacote de primitivos: há formulário de endereço,
   moeda, badge de categoria, WhatsApp, viewer 3D e carrossel no mesmo
   diretório.
5. A referência `modular-api-anatomy` admite `apps/services/api`. Esta tarefa
   **não** extrai o backend. Fase 5 fica no host Next, com Prisma server-only.
6. `/catalog` não existe. Passa a existir como rota nova do catálogo de
   primitivos. Nenhuma URL atual é renomeada para abri-la.
7. O script trata `lib/validations` como código de produto a mapear. Esse gerado
   permanece server-only até a fase de backend, e o schema Prisma não muda.

## Contratos que não mudam

### URLs de página (relidas em `app/**/page.tsx`)

`/`, `/admin`, `/admin/categorias`, `/admin/dashboard`, `/admin/email`,
`/admin/equipamentos`, `/admin/equipamentos/novo`, `/admin/equipamentos/[id]`,
`/admin/equipamentos/[id]/editar`, `/admin/financeiro`, `/admin/login`,
`/admin/logistics`, `/admin/maintenance`, `/admin/orcamentos`,
`/admin/orcamentos/[id]`, `/admin/permissions`, `/admin/rentals`,
`/admin/settings`, `/admin/teste-toast`, `/admin/whatsapp`, `/api-docs`,
`/area-cliente`, `/area-cliente/enderecos`, `/area-cliente/historico`,
`/area-cliente/historico/[id]`, `/area-cliente/notificacoes`,
`/area-cliente/perfil`, `/auth/callback`, `/cadastro`, `/contato`, `/cookies`,
`/entrar`, `/equipamentos`, `/equipamentos/[id]`, `/equipamentos-scroll`,
`/grid-motion`, `/login`, `/orcamento`, `/playground`,
`/playground/icon-customization`, `/politica-devolucao`, `/privacidade`,
`/recuperar-senha`, `/reset-password`, `/sobre`, `/termos`.

Há 135 arquivos `app/api/**/route.ts`. O caminho de cada um permanece. Payloads
não foram caracterizados nesta fase.

### Webhooks observados

- `app/api/payments/boleto/webhook/route.ts`
- `app/api/payments/pix/webhook/route.ts`
- `app/api/webhooks/whatsapp/route.ts`
- `app/api/contracts/zapsign-webhook/route.ts`

Nenhum `route.ts` em `app/api` contém a string `stripe`. O cliente Stripe está
em `lib/stripe.ts`. Mercado Pago e Asaas aparecem em `lib/payment-gateways/`.
Não mover nem alterar esses módulos na fase de UI.

### Eventos e textos legais

- GA4 / Google Ads no `app/layout.tsx` (`gtag`).
- `components/ui/cta-button.tsx` dispara `gtag('event', 'click', ...)`.
- Páginas legais: `/termos`, `/privacidade`, `/cookies`, `/politica-devolucao`.
  Texto não é reescrito.

### Efeitos de banco proibidos nesta migração

Não rodar `pnpm db:push`, `db:seed`, `db:clean:*`, `db:backfill:*`,
`db:dedupe:*`, `migrate:*`, `fix:rls` nem scripts irmãos. Models lidos no
schema, sem alteração: `User`, `ZohoMailToken`, `WhatsAppConversation`,
`WhatsAppMessage`, `Account`, `Session`, `VerificationToken`, `Address`, `Cart`,
`CartItem`, `Category`, `Equipment`, `EquipmentUnit`, `Quote`, `QuoteItem`,
`rental_items`, `rentals`, `Setting`, `Maintenance`, `Payment`,
`FinancialSetting`, `QuoteAdjustment`, `ClientDocument`, `Delivery`, `Vehicle`,
`Driver`, `Contract`, `AuditLog`, `Notification`, `Permission`.

`QuoteStatus` observado: `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`.
Preservar, inclusive bug documentado em `docs/issues` quando a fatia
correspondente for caracterizada. Marca: `[BUG_PRESERVADO: <id>]`. Não corrigir
dentro da fatia estrutural.

## Hotspots (git, frequência de mudança)

Comando: `git log --pretty=format: --name-only`, agrupado, excluindo
`node_modules`, `.agents` e `.claude`. Exit 0.

| Contagem | Caminho                                                        |
| -------- | -------------------------------------------------------------- |
| 469      | `lib/validations/.prisma-zod-generator-manifest.json` (gerado) |
| 284      | `CHANGELOG.md`                                                 |
| 246      | `package.json`                                                 |
| 210      | `pnpm-lock.yaml`                                               |
| 133      | `app/globals.css`                                              |
| 104      | `app/admin/orcamentos/page.tsx`                                |
| 98       | `docs/issues/known-issues.md`                                  |
| 72       | `components/ui/modern-category-modal.tsx`                      |
| 68       | `components/hero.tsx`                                          |
| 65       | `app/orcamento/page.tsx`                                       |
| 64       | `app/admin/equipamentos/page.tsx`                              |
| 59       | `app/admin/categorias/page.tsx`                                |
| 57       | `components/admin/admin-sidebar.tsx`                           |
| 56       | `app/equipamentos/[id]/page.tsx`                               |
| 56       | `lib/validations/helpers/decimal-helpers.ts`                   |
| 50       | `app/area-cliente/page.tsx`                                    |

Acoplamento temporal e distribuição por autor não foram calculados à parte: o
mesmo histórico alimenta a frequência. Cobertura de teste por arquivo:
[INFORMATION_NEEDED: cobertura]. Não bloqueia o plano; bloqueia qualquer
movimento de hotspot sem teste de caracterização.

Prioridade de caracterização quando a fatia chegar, não antes do esqueleto:
orçamento admin, orçamento público, equipamentos, hero, `globals.css`, sidebar
admin, área do cliente, `decimal-helpers`.

## Ordem das fatias

Cada fatia: caracterização do comportamento atual, movimento, import só pela API
pública, gate estreito, seção neste diário. Legado sai só quando a busca global
não achar o caminho antigo e os mesmos casos passarem. Estado com pasta legada
viva: `intermediate`.

| Id         | Quando                 | Conceito                                                                                                                                                                     |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00         | agora                  | Plano. Bloqueado em `npm_scope`                                                                                                                                              |
| 01         | após o escopo          | Esqueleto ao lado do app legado. Hosts finos, `packages/frontend`, `packages/ui`, `packages/design-tokens`, `pnpm arch` e `pnpm tokens` instalados. `app/` continua servindo |
| 02         | em seguida             | Tokens. Camadas primitiva, semântica e de componente a partir de `design-tokens/` e `app/globals.css`. Sem apagar a fonte antiga                                             |
| 03…        | um primitivo por fatia | `packages/ui`: contrato + `.web.tsx` + `.native.tsx`. Começar por `button` (já há `tests/components/button.test.tsx`). Negócio que está em `components/ui` não entra aqui    |
| depois     | um conceito por fatia  | `entities`: equipamento, orçamento, locação, pagamento, cliente, categoria                                                                                                   |
| depois     | um conceito por fatia  | `features`: ações reutilizadas (`use-quote-form`, carrinho, filtros). Leitura de um conceito fica em `entities/<substantivo>/api`                                            |
| depois     | um bloco por fatia     | `widgets` só quando o bloco servir mais de uma page. Uso único permanece na page                                                                                             |
| depois     | uma page por fatia     | `packages/frontend/src/pages/<pagina>` + rota fina em `apps/clients/web`. Server Component permanece server component                                                        |
| depois     | espelho                | `apps/clients/mobile` renderiza as mesmas pages. Não importa o client web. Catálogo em `/catalog` e tela `catalog`                                                           |
| depois     | aposentadoria          | Apagar pasta legada só com substituto verde e zero imports                                                                                                                   |
| por último | backend                | Módulos no host. Sem FSD no servidor. Sem novo deploy. Prisma continua server-only                                                                                           |

Hotspots de orçamento e equipamento esperam a fatia do conceito. Não são o
primeiro movimento: tokens e o primitivo Button não dependem deles.

## Prova que esta fase não executou

- [NOT_VERIFIED: pnpm arch]
- [NOT_VERIFIED: pnpm tokens]
- [NOT_VERIFIED: pnpm test]
- [NOT_VERIFIED: pnpm type-check]
- [NOT_VERIFIED: pnpm build]
- [INFORMATION_NEEDED: cobertura]
- [INFORMATION_NEEDED: npm_scope]
