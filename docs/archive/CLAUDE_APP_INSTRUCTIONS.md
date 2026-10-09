# GB Locações - Instruções do Projeto

## Visão Geral do Projeto

**GB Locações** é uma plataforma SaaS full-stack para gestão de locação de
equipamentos de construção no Brasil. O sistema inclui:

- Catálogo público de equipamentos com busca avançada
- Sistema de orçamentos com configuração individual de períodos
- Painel administrativo completo (financeiro, logística, manutenção, email)
- Processamento de pagamentos (Boleto, PIX, Cartão)
- Integrações externas (Zoho Mail, WhatsApp, Google Merchant, ZapSign)
- Portal do cliente com histórico e notificações
- Sistema de KPIs e analytics

**Status**: Produção, 100% estável, zero erros TypeScript/ESLint.

---

## Stack Tecnológico

| Camada           | Tecnologia                                  |
| ---------------- | ------------------------------------------- |
| **Framework**    | Next.js 16.1.6 (App Router, Turbopack)      |
| **Linguagem**    | TypeScript 5.9.3 (strict mode)              |
| **UI**           | React 19.2.4, Radix UI, Tailwind CSS 3.4.17 |
| **Estado**       | Zustand 5.0.11, React Hook Form 7.71.1      |
| **Validação**    | Zod 4.3.6 (auto-gerado do Prisma)           |
| **Banco**        | PostgreSQL + Prisma ORM 7.4.0               |
| **Autenticação** | NextAuth.js 4.24.13 (JWT, OAuth)            |
| **Pagamentos**   | Stripe 20.3.1, Asaas (Boleto/PIX)           |
| **Email**        | Resend 6.9.2, Zoho Mail (admin)             |
| **Storage**      | Supabase 2.95.3                             |
| **Testes**       | Vitest 4.0.18, Playwright 1.58.2            |
| **Gerenciador**  | pnpm 10.27.0                                |

**⚠️ INCOMPATIBILIDADES CRÍTICAS:**

- ❌ **Prisma 6.14.0+**: Quebra com Next.js 16.0.3
- ❌ **Tailwind CSS 4.x**: Quebra design system inteiro

---

## Estrutura do Projeto

```
app/
  admin/           # Dashboard admin (45 páginas)
    dashboard/
    financeiro/    # Gestão financeira
    orcamentos/    # Gestão de orçamentos
    equipamentos/  # CRUD equipamentos
    email/         # Integração Zoho Mail
    whatsapp/      # WhatsApp Business API
  api/             # 130+ rotas RESTful
  area-cliente/    # Portal do cliente
  equipamentos/    # Catálogo público
  auth/            # Páginas de autenticação

components/
  ui/              # 76 componentes base (Radix UI + custom)
  admin/           # Componentes específicos admin
  dialogs/         # Sistema de modais

lib/
  auth.ts          # Configuração NextAuth
  prisma.ts        # Singleton Prisma
  validations/     # Schemas Zod auto-gerados
  payment-gateways/ # Stripe, Asaas, Boleto
  google-merchant/ # Sync Google Shopping
  zoho-mail/       # Cliente Zoho Mail

prisma/
  schema.prisma    # 40+ modelos

tests/
  critical/        # 10 testes críticos (financeiro, pagamentos)
```

---

## REGRAS DE NEGÓCIO CRÍTICAS

### 1. Sistema de Orçamentos (MAIS IMPORTANTE)

**Princípio Central**: Cada equipamento no orçamento tem **configuração
independente de período** na página de detalhes (`/equipamentos/[id]`), NÃO no
formulário de orçamento.

**Fluxo Correto:**

1. Cliente seleciona equipamento
2. Configura **datas início/fim** e **opção "apenas dias úteis"** na página de
   detalhes
3. Equipamento adicionado ao carrinho com: `startDate`, `endDate`, `days`,
   `includeWeekends`, `selectedPeriod`
4. No `/orcamento`, cada item exibe suas datas e período específicos
5. Submissão valida disponibilidade **por item** usando datas específicas
6. Orçamento gera `quoteCode` no padrão `Q-YYYY-SEQUENCIAL` (ex: `Q-2026-0001`)

**❌ NUNCA:**

- Adicionar campo de período global no formulário de orçamento
- Remover validação de datas por item
- Esconder detalhes de preço (período, desconto%, preço original riscado, preço
  final, preço/dia)

**Inteligência de Preços:**

- Determinação de período por dias: 1-6 (diária), 7-14 (semanal), 15-29
  (quinzenal), 30+ (mensal)
- Dois modos por período:
  - **Desconto**: `dailyDiscount=10%` → aplica % na diária × dias
  - **Valor direto**: `weeklyDirectValue=500` → usa valor fixo
- Cálculo em `lib/quote-pricing.ts` via `buildQuotePricing()`

**Bloqueio de Estoque:**

- Dispara APENAS após pagamento confirmado (webhook Asaas)
- Botão de aprovar NÃO bloqueia estoque sozinho
- Orçamento permanece `PENDING` até receber pagamento
- Para `paymentTerms=AT_END`: aprovação pode prosseguir sem pagamento inicial

**Boleto (Asaas):**

- Gerado automaticamente se CPF/CNPJ presente e total > 0
- Se total ajustado com boleto pendente → regenera com novo valor
- `dueDate` editável via `/admin/financeiro` com sync para gateway
- Vencimento padrão: 3 dias úteis

### 2. Modos de Pagamento

**UPFRONT/ON_DELIVERY:**

- PENDING → Admin aprova → Cliente paga → APPROVED

**AT_END:**

- PENDING → Admin aprova → Pode converter sem pagamento inicial
- Status PENDING para aprovação, APPROVED quando pago
- Permite flexibilidade operacional

### 3. Financeiro (`/admin/financeiro`)

**Entidades:**

- `Payment` (tipo RENTAL + método BOLETO para recebíveis)
- `FinancialSetting` (taxas: CPF, CNPJ, CNI)

**Recursos:**

- Busca unificada (nome, `quoteCode`, código legado)
- Filtros por status operacional
- Visualização tabela + calendário
- Exportação PDF em lote
- Edição de vencimento com sync
- Debounce de 350ms na busca

### 4. Permissões e Roles

**Hierarquia:**

- `ADMIN`: Acesso total
- `FINANCIAL`: Apenas `/admin/financeiro` + APIs relacionadas
- `OPERATOR`: Compatibilidade legado (não recomendado)
- `CLIENT`: Sem acesso admin

**Guards de API:**

```typescript
requireAdmin()              // Apenas ADMIN
requireFinancialAccess()    // ADMIN ou FINANCIAL
requireRoles([...])         // Roles específicas
```

### 5. Google Merchant Center

**Campos Imutáveis em Update:**

- `offerId`, `targetCountry`, `contentLanguage`, `feedLabel`, `channel`, `link`
- Remover desses campos no `products.update`
- Usar `products.insert` (upsert) para alterá-los

**URLs de Produto:**

- NUNCA usar `NEXTAUTH_URL` (é localhost em dev)
- Usar `GOOGLE_MERCHANT_WEBSITE_URL` com fallback para
  `https://locacoesgb.com.br`

**Custom Labels:**

- Campos top-level (`customLabel0`), NÃO nested
- `identifierExists: false` para equipamentos sem GTIN/MPN
- Filtrar imagens adicionais: apenas http/https válidos

---

## PADRÕES DE CÓDIGO

### Nomenclatura de Arquivos

```
Componentes:    PascalCase.tsx       (Button.tsx)
Hooks:          use-kebab-case.ts    (use-cart.ts)
Utilitários:    kebab-case.ts        (api-response.ts)
Stores:         useXxxStore.ts       (useCartStore.ts)
```

### Padrão de Rota API

```typescript
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  // 1. Rate limiting
  const rateLimitResult = checkRateLimit(request, adminApiRateLimit)
  if (!rateLimitResult.allowed) return rateLimitResult.response!

  // 2. Autenticação
  const auth = await requireAdmin()
  if (!auth.success) return authError(auth)

  // 3. Validação (Zod)
  const data = SomeSchema.parse(await request.json())

  // 4. Lógica de negócio
  const result = await prisma.model.findMany(...)

  // 5. Resposta padronizada
  return NextResponse.json({ success: true, data: result })
}
```

### Validação com Zod

```typescript
// Usar schemas auto-gerados de lib/validations/
import { EquipmentSchema } from "@/lib/validations"

// Ou custom em lib/validators/
const schema = z.object({
  name: z.string().min(3),
  pricePerDay: z.number().positive()
})

const data = schema.parse(input) // Throws ZodError
```

### Rate Limiting

```typescript
strictRateLimit // 10/min  - Envio email, operações sensíveis
adminApiRateLimit // 200/min - APIs admin
apiRateLimit // 100/min - APIs gerais
authRateLimit // 5/15min - Login
```

### Moeda (CRÍTICO)

```typescript
// ✅ SEMPRE usar Decimal.js
import { Decimal } from "decimal.js"
const price = new Decimal("19.99")
const total = price.times(quantity)
const finalValue = Number(total) // Para JSON

// ❌ NUNCA usar floats
const wrong = 19.99 * 1.1 // PROIBIDO
```

### Componentes React

```typescript
// Server Component por padrão
export default function Page() { ... }

// Client Component quando necessário
'use client'
export default function Interactive() { ... }

// Usar CVA para variantes
const buttonVariants = cva('base-classes', {
  variants: { variant: {...}, size: {...} }
})
```

---

## DESIGN SYSTEM

### Componentes UI (76 componentes)

**Reutilização > Recriação** - SEMPRE verificar `components/ui/` antes de criar
novo componente.

**Principais:**

- **Button**: 7 variantes (default, destructive, outline, ghost, ghost-white,
  reset, gradient) + 5 tamanhos (compact, default, sm, lg, icon)
- **Dialog**: Suporte a nested dialogs, scroll customizado, variantes
  default/compact
- **Card**: Composição (Header, Title, Description, Content, Footer)
- **Input**: Number input com setas laranja, validação

**Padrão CVA:**

```typescript
<Button variant="default" size="compact">
  Enviar
</Button>
```

### Sistema de Cores

```typescript
// Primárias
slate-700  // #334155 - Botões, sidebar
orange-600 // #ea580c - Accent, hover
gray-200   // #e5e7eb - Bordas

// Variantes de Button
default:       bg-slate-700 hover:bg-slate-600 hover:scale-105
destructive:   bg-red hover:scale-105
ghost-white:   hover:bg-white hover:text-orange-600 (sidebar)
reset:         hover:text-orange-500 hover:shadow-lg (SEM scale)
```

### Z-Index Layers

```css
--layer-base: 0 --layer-floating: 20 --layer-dropdown: 60 --layer-popover: 70
  --layer-dialog-backdrop: 80 --layer-dialog: 90 --layer-tooltip: 100;
```

### Tipografia

```
Fonte corpo:    Inter (--font-inter)
Fonte títulos:  Jost (--font-jost)

h1: clamp(2.5rem, 5vw, 3.5rem)
h2: clamp(2rem, 4vw, 3rem)
p:  clamp(1rem, 2vw, 1.125rem)
```

### Admin Page Header (OBRIGATÓRIO)

```typescript
<AdminPageHeader
  title="Título"
  subtitle="Descrição"
  icon={<Icon />}
  infoBadge={{ icon: <Icon />, text: "Info" }}
/>
```

---

## BANCO DE DADOS

### Modelos Principais (40+ modelos)

**Core:**

- User, Account, Session, Address, Permission, AuditLog

**Equipamentos:**

- Category, Equipment, EquipmentUnit

**Orçamentos & Locações:**

- Quote, QuoteItem, QuoteAdjustment
- rentals, rental_items

**Financeiro:**

- Payment, FinancialSetting, ClientDocument

**Operações:**

- Delivery, Vehicle, Driver, Contract, Maintenance

**Comunicação:**

- WhatsAppConversation, WhatsAppMessage, Notification

### Padrões Prisma

```typescript
// ✅ SEMPRE usar Prisma ORM
const items = await prisma.equipment.findMany({
  where: { available: true },
  include: { category: true }
})

// ❌ NUNCA usar SQL raw
const result = await prisma.$queryRaw`...` // PROIBIDO
```

---

## SEGURANÇA

### Sanitização HTML

```typescript
import { sanitizeHtml, plainTextToHtml } from "@/lib/sanitize"

// Para conteúdo rico
const clean = sanitizeHtml(html)

// Para plain text → HTML
const safe = sanitizeHtml(plainTextToHtml(content))
```

### Audit Logging

```typescript
import { createAuditLog } from "@/lib/audit-logger"

await createAuditLog({
  userId: user.id,
  action: "SEND", // CREATE|UPDATE|DELETE|APPROVE|SEND|etc
  entity: "EMAIL", // EQUIPMENT|QUOTE|PAYMENT|EMAIL|etc
  entityId: emailId,
  changes: { to, subject },
  request
})
```

### Idempotência

```typescript
// Para operações críticas (pagamentos, envios)
const cached = checkIdempotency(request.headers.get("X-Idempotency-Key"))
if (cached) return NextResponse.json(cached)

const result = await processOperation()
storeIdempotency(key, result)
```

---

## INTEGRAÇÕES EXTERNAS

### Email (Zoho Mail)

**Schemas**: `lib/zoho-mail/schemas.ts`

```typescript
SendEmailSchema // Para envio
ReplyEmailSchema // Para respostas
SaveDraftSchema // Para rascunhos
```

**Rate Limits:**

- Send/Reply: `strictRateLimit` (10/min)
- Drafts/Upload: `adminApiRateLimit` (200/min)

**Sanitização**: `sanitizeHtml(plainTextToHtml(content))`

### Google Merchant Sync

**Auto-sync**: Fire-and-forget em rotas CRUD de equipamentos

```typescript
if (equipment.available) {
  import("@/lib/google-merchant")
    .then(({ googleMerchantSync }) =>
      googleMerchantSync.syncEquipment(equipment.id)
    )
    .catch((err) => console.error("Sync failed:", err))
}
```

**Cron**: `/api/cron/sync-google-merchant` (requer `CRON_SECRET`)

### Pagamentos

**Asaas (Boleto/PIX):**

- Status mapping: `mapAsaasStatus()`
- Webhook com HMAC SHA256
- Validação de assinatura

**Stripe:**

- Cards internacionais
- Webhooks para confirmação

---

## COMANDOS IMPORTANTES

```bash
# Desenvolvimento
pnpm dev                    # Dev server (Turbopack)
pnpm dev:network            # Acessível na rede

# Database
pnpm db:generate            # Gera Prisma client + Zod
pnpm db:push                # Push schema para DB
pnpm db:studio              # Prisma Studio GUI

# Qualidade
pnpm lint                   # ESLint
pnpm format                 # Prettier
pnpm type-check             # TypeScript
pnpm quality:fix            # Format + lint + markdown

# Testes
pnpm test                   # Todos os testes
pnpm test:coverage          # Com coverage
pnpm ci:full                # CI completo

# Build
pnpm build                  # Build produção
pnpm start                  # Servidor produção
```

---

## REGRAS CRÍTICAS - NUNCA FAZER

1. ❌ **Floats para moeda** → Usar `Decimal.js`
2. ❌ **SQL raw** → Usar Prisma ORM
3. ❌ **Período global em orçamentos** → Períodos individuais por item
4. ❌ **Atualizar Tailwind para 4.x** → Quebra design system
5. ❌ **Atualizar Prisma 6.14.0+** → Quebra com Next.js 16
6. ❌ **Criar componentes duplicados** → Verificar `components/ui/` primeiro
7. ❌ **Usar `NEXTAUTH_URL` para links de produto** → Usar
   `GOOGLE_MERCHANT_WEBSITE_URL`
8. ❌ **Esquecer rate limiting em rotas públicas** → Sempre aplicar
9. ❌ **Expor erros detalhados em produção** → Apenas em dev
10. ❌ **Omitir audit log em operações financeiras** → Sempre logar

---

## VARIÁVEIS DE AMBIENTE CRÍTICAS

```bash
# Auth
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Database
DATABASE_URL=postgresql://...

# Pagamentos
ASAAS_API_KEY=
ASAAS_WEBHOOK_SECRET=
BOLETO_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
FROM_EMAIL=

# Google Merchant
GOOGLE_MERCHANT_ID=
GOOGLE_MERCHANT_WEBSITE_URL=https://locacoesgb.com.br
GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL=
GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY=

# Zoho Mail
ZOHO_MAIL_API_KEY=
ZOHO_MAIL_CLIENT_ID=
ZOHO_MAIL_CLIENT_SECRET=

# Cron
CRON_SECRET=

# Features
AUTO_GENERATE_BOLETO_ON_QUOTE=true
LOG_LEVEL=info
NODE_ENV=production
```

---

## IDIOMA

**Aplicação em Português Brasileiro (`pt-BR`):**

- Texto da UI
- Mensagens de erro
- Documentação
- Commits em inglês (convenção Git)

---

## PERFORMANCE

**Otimizações Implementadas:**

1. Scroll reveal com `requestAnimationFrame` batching (2000ms check)
2. Debounce/throttle para eventos alta frequência
3. Bundle splitting (Three.js, Framer Motion, GSAP, Radix UI)
4. Imagens Next.js com lazy loading
5. Memoização de componentes admin pesados
6. `startTransition` para atualizações de estado

**Metas:**

- LCP Mobile: < 2500ms
- TBT: < 600ms
- Performance Score: > 90/100

---

## TESTES CRÍTICOS

**10 suítes críticas em `tests/critical/`:**

- financial-due-date.test.ts
- financial-entries.test.ts
- late-fee.test.ts
- payment-processor.test.ts
- quote-adjustment.test.ts
- quote-boleto.test.ts
- quote-flow.test.ts
- quote-payment-terms.test.ts
- stock-blocking.test.ts
- tax-engine.test.ts

**❌ Mudanças que quebram testes críticos NÃO podem ser mergeadas.**

---

## DOCUMENTAÇÃO

**Protocolo de Contexto:**

1. Começar com `docs/ai/boot.md`
2. Usar `docs/ai/context-map.md` para encontrar docs por tipo de tarefa
3. Ler feature docs (`docs/features/*.md`) para implementações específicas
4. Atualizar `CHANGELOG.md` após mudanças (formato git log)
5. Criar/atualizar docs usando `docs/features/_template.md`

---

## QUANDO PEDIR AJUDA AO USUÁRIO

**Sempre perguntar ANTES de:**

1. Alterar lógica do sistema de orçamentos (períodos individuais)
2. Modificar cálculos financeiros ou de preços
3. Mudar fluxo de pagamentos ou conversão de orçamentos
4. Adicionar/remover campos em modelos Prisma críticos
5. Alterar permissões de roles
6. Modificar integrações externas (Asaas, Zoho, Google Merchant)
7. Quebrar compatibilidade com versões específicas (Tailwind, Prisma)

**Pode prosseguir sem perguntar:**

1. Correções de bugs evidentes
2. Refatoração de código mantendo comportamento
3. Adição de validações
4. Melhorias de performance sem mudanças funcionais
5. Correções de tipos TypeScript
6. Adição de testes
7. Atualização de documentação

---

## SOBRE ESTE PROJETO

GB Locações é uma plataforma SaaS enterprise-grade, production-ready, com:

- 45 páginas de rotas
- 130+ endpoints API
- 189 componentes React
- 40+ modelos de banco de dados
- 100% TypeScript strict
- Zero erros de lint
- Cobertura de testes em funcionalidades críticas
- Compliance com regulações brasileiras (ISS, IRPJ, CSLL, PIS/COFINS)

**Arquitetura**: Modern full-stack com Next.js 16 App Router, React 19 Server
Components, Prisma ORM, Tailwind CSS + Radix UI, integração completa com
serviços brasileiros de pagamento e comunicação.
