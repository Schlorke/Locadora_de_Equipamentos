# Features Index

Use this index to find the right feature doc quickly.

## Critical Docs (Read First When Relevant)

- [Detalhe público de equipamento](equipment-detail.md): preço/datas e galeria
  no web/Expo; orçamento nativo e aparelho ainda pendentes.
- [Conteúdo institucional e textos legais da vitrine](conteudo-da-vitrine.md):
  conteúdo, compromissos e Termos/Privacidade/Devolução por locadora em
  `settings`, leitura pública e rotas nos dois hosts, vitrine web e app, páginas
  legais no ar na pausa e painel web e nativo (onda 134); nota (D-A), frota
  (D-B) e frete (P-1) da GB pendentes.
- [SEO, medição e verificação da vitrine](seo-e-medicao-da-vitrine.md): título,
  descrição, canonical e Open Graph por página com os dados da locadora;
  GA4/Google Ads e verificação do Search Console e da Meta pelo painel, com CSP
  por host; Vercel Analytics e Speed Insights da plataforma (onda 135).
- [Site público por estado (S13)](site-por-estado.md): vitrine LIVE, PAUSED (503
  `SITE_PAUSED`, página de pausa e `noindex`) ou OFF (404 do D10) e área do
  cliente pela linha da B.5, que continua com o site desligado; regras únicas no
  domínio e no resolvedor dos dois hosts; despublicação pendente.

- `docs/features/modernization-frontend.md`
- `docs/features/tenant-hosts-web.md`
- `docs/features/tenant-request-resolution.md`
- `docs/features/shared-api-host.md`
- `docs/features/contracts.md` — geração, assinatura durável, download privado e
  callback ZapSign nos dois hosts (onda 42). Efeitos de assinatura/arquivo e
  adapter compartilhados na onda 43; scheduler continua único no legado. Não
  retirar a API anterior antes da paridade operacional.
- `docs/features/client-documents-antifraud.md` — upload ADMIN/OPERATOR e
  listagem ADMIN/OPERATOR ou CLIENT proprietário nos dois hosts (onda 43).
  Bucket privado, TTL de cinco minutos, ownership e compensação do upload
  preservados; documento manual não equivale ao evento de assinatura ZapSign.
- `docs/features/admin-system.md` — GET/POST e PUT/DELETE por id de categorias
  administrativas nos dois hosts, com permissão granular, ownership e catálogo
  compartilhado. GET/POST de unidades físicas também estão no serviço; criação
  preserva medidores, unicidade por locadora e estoque (corte 30). PATCH/DELETE
  por id preservam posse, ações distintas e recusa de exclusão em uso (corte
  31). POST de equipamentos também composto, com WRITE, limite compartilhado com
  GET por processo e catálogo existente (corte 32). PUT/DELETE de equipamento
  também compostos (onda 33), com DTO e posse preservados. Ciclo administrativo
  de locação também composto (onda 35), com schemas existentes comuns, lock,
  documentos, centavos e outbox no backend. Upload de imagens ADMIN e GET/PUT de
  settings também compostos (onda 44), com contratos comuns, sanitização, quota
  SQL e segredos preservados; cache entre hosts depende da migração operacional.
- `docs/features/operations-tenancy.md` — GET/POST de motoristas compostos nos
  dois hosts com ADMIN da locadora atual, CSRF e schema compartilhado. Veículos
  GET/POST e logística GET/POST/PATCH compartilham operations na onda 33.
- `docs/features/cart-pricing-sync.md` — API por usuário/locadora e preços do
  carrinho; GET/POST sync e POST merge compartilham customers no serviço
  parcial.

- `docs/features/equipment-3d-carousel.md`
- `docs/features/quote-system.md` — consultas do cliente por id e
  administrativas no serviço compartilhado (onda 34), com factories e contratos
  existentes. GET da lista do cliente também compartilhado na onda 35.
- `docs/features/area-cliente-historico-detalhes.md` — portal de locações, soft
  delete e pedidos de coleta/prorrogação nos dois hosts (onda 34). Atividades e
  prorrogação direta, distinta do pedido de atendimento, compostas na onda 35.
- `docs/features/admin-system.md`
- `docs/features/admin-financeiro-page.md`
- `docs/features/admin-permissions-and-roles.md`
- `docs/features/client-documents-antifraud.md`
- `docs/features/dialog-lab.md`
- `docs/features/design-system.md`
- `docs/features/hero-section.md`
- `docs/features/ai-context-system.md`

## Find a Feature Doc

- List all feature docs: `rg --files docs/features`
- Search by keyword: `rg -n "keyword" docs/features`

## Outros

- `docs/features/admin-zoho-mail-integration.md` — Viabilidade e design da
  integração Zoho Mail no painel admin (ler/arquivar/excluir/editar rascunhos).
- `docs/features/admin-email-ui-ux.md` — Interface de email estilo Outlook com
  layout unificado, Preview Pane ajustável e visualização completa.
- `docs/features/admin-whatsapp-ui-ux.md` — Interface de WhatsApp no painel
  admin (Meta Cloud API, conversas, mensagens, responder, webhook).
- `docs/features/scroll-area.md` — Componente base de ScrollArea (Radix) e
  regras de espessura do thumb.

## New Feature Docs

- Use the template: `docs/features/_template.md`.
- Name files in kebab-case: `docs/features/<feature-name>.md`.
- Link new docs from here when they become critical.

## Componentes de UI / Orçamento

- `docs/features/equipment-quote-price-block.md` — Bloco padrão de preço por
  equipamento (nome, preço original, desconto, preço final); mesmo formato DOM
  em área do cliente e admin.

## 2026-02 Financial/Access Updates

- `docs/features/admin-financeiro-page.md` — painel financeiro dedicado
  (tabela/calendario, status, exportacao e aliquotas).
- `docs/features/admin-permissions-and-roles.md` — matriz de roles/permissoes
  (`ADMIN`, `FINANCIAL`, `OPERATOR`, `CLIENT`) e guardas centralizadas.
- `docs/features/quote-price-adjustment.md` — reajuste categorizado de orcamento
  com envio e trilha de auditoria.
- `docs/features/client-documents-antifraud.md` — upload privado de documentos
  sensiveis e bloqueio de fechamento sem documentos obrigatorios.

_Last updated: 2026-02-11_

## Modernização multiempresa

- `docs/features/modernization-billing.md` — Obrigações, tentativas,
  cancelamento e recuperação.
- `docs/features/customer-addresses.md` — Leitura e escrita compartilhadas de
  endereços com ownership e locadora explícitos; clientes ainda usam o legado.
- `docs/features/customer-profile.md` — Perfil comercial por usuário e locadora;
  GET/PUT compartilhados, contrato estrito, ownership e ausência de fallback
  global.
- `docs/features/notification-system.md` — Notificações por destinatário e
  locadora; listagem, estatísticas e marcação/exclusão compartilhadas; sync
  legado.

- [Seleção de locadora](organization-selection.md): listagem de vínculos e
  preferência validada por sessão.

- [Documentos de orçamento](quote-documents.md): PDFs reais e consultas
  administrativas isoladas.

### Locadora por host e gates (onda 2)

- `docs/features/tenant-hosts-web.md` — **crítico**: proxy do host web, árvore
  por host, providers por grupo, gateway server-only e modo host do frontend.
- `docs/features/tenant-request-resolution.md` — **crítico**: borda validada,
  `resolvePublicRequestTenant` (400/409/404 neutro), cartão público e
  `/api/auth/organizations/current`.
- `docs/features/tenant-slug-policy.md` — **crítico**: política de slug no
  banco, `pnpm tenant:slug-preflight` e padrão de preflight sob FORCE RLS.
- `docs/features/structured-data-json-ld.md` — **crítico**: todo JSON-LD passa
  por `serializeJsonLd`.
- `docs/features/ratchet-gates.md` — **crítico**: catracas de arquitetura e
  tokens, `ratchet:guard`, `--rename` e `--adopt-coverage`.

### Plataforma SaaS por assinatura (lote S0)

Contratos em `@gb-locacoes/contracts`; ADR
`docs/architecture/adr-saas-subscription.md`.

- `docs/features/assinatura-plataforma.md` — **crítico**: seis estados, projeção
  de acesso, faturas da mensalidade e escritas permitidas em pausa.
- `docs/features/limites-plano.md` — **crítico**: `EntitlementsV1`, `Money` em
  string decimal e códigos 402/403/409 de acesso.
- `docs/features/onboarding-locadora.md` — **crítico**: cadastro em
  `app.<raiz>/comecar`, assistente web de sete etapas, CNPJ alfanumérico e
  aceites aprovados; cadastro real desligado, Expo limitado a estados/link do
  painel.
- `docs/features/conta-recebimentos.md` — **crítico**: modos BaaS, STANDARD e
  conta conectada, estados e ações do dono; consulta/tela web entregues na onda
  120; criação pelo dono, saúde da subconta e barreira de emissão na onda 134
  (desligada por padrão). Runbook em
  `docs/operations/runbook-asaas-subaccount.md`.
- `docs/features/backoffice-plataforma.md` — **crítico**: papéis da equipe,
  matriz de permissões e acesso de suporte.

### Identidade multi-host e diretório (onda 3)

- `docs/features/tenant-client-enrollment.md` — **crítico**: vínculo com
  consentimento (`POST /api/client/enroll`), área do cliente em modo host e
  confirmação do `?locadora=` no painel. POST com adapter no serviço parcial e
  paridade de sessão real, efeitos e rollback; legado permanece ativo.
- `docs/features/tenant-directory-search.md` — **crítico**: busca pública de
  locadoras com opt-in `directoryListed` e rate limit em `platform_rate_limits`.
