<CONTEXTO_EM_TEXTO>

# GB Locações — Prompt de Implementação Completo do Módulo Financeiro

---

## 1. Visão Geral do Projeto

A **GB Locações** é uma plataforma SaaS brasileira de gestão de locação de
equipamentos para construção civil (balanças, andaimes, rompedores, betoneiras,
compressores, etc.). A empresa opera desde 2021 com aproximadamente 125
equipamentos e está a migrar de controlo manual via planilhas Excel para este
sistema web.

**Participantes-chave:**

- **Gustavo**: Proprietário da empresa
- **Francisco Pernier**: Operacional (filho do Gustavo), acesso de administrador
- **Adriana (Secretária/TGD)**: Responsável pelo financeiro — **ATENÇÃO
  CRÍTICA**: Adriana já estragou planilhas e relatórios ao mexer em
  funcionalidades fora do seu escopo. O controlo de acesso por perfil é a
  **prioridade nº 1** para evitar recorrência.

**Website**: locacoesgb.com.br **Login**: Via Google OAuth **Idioma**: Português
Brasileiro (pt-BR)

---

## 2. Stack Tecnológica

| Camada          | Tecnologia                      | Versão                   |
| :-------------- | :------------------------------ | :----------------------- |
| Framework       | Next.js (App Router, Turbopack) | 16.1.6                   |
| Linguagem       | TypeScript (strict mode)        | ~5.x                     |
| UI              | React 19, Radix UI, TailwindCSS | 19.2.4 / latest / 3.4.17 |
| Animações       | Framer Motion                   | 12.34.2                  |
| Gráficos        | Recharts                        | 3.7.0                    |
| Estado          | Zustand, React Hook Form        | -                        |
| Validação       | Zod (auto-gerado do Prisma)     | 4.3.6                    |
| ORM             | Prisma (PostgreSQL)             | 7.4.0                    |
| Auth            | NextAuth.js (JWT, Google OAuth) | 4.24.13                  |
| Excel           | ExcelJS                         | 4.4.0                    |
| PDF             | pdfkit                          | -                        |
| Toasts          | Sonner                          | -                        |
| Ícones          | Lucide React                    | 0.574.0                  |
| Datas           | date-fns                        | 4.1.0                    |
| Package Manager | pnpm                            | 10+                      |

**Convenções de Código:**

- Path alias: `@/*` mapeia para `./*` (raiz do projeto)
- Componentes base: `components/ui/` (Button, Card, Dialog, Select, etc.)
- Componentes admin: `components/admin/`
- APIs admin: `app/api/admin/`
- Toasts via `sonner` (toast.success, toast.error)
- Ícones via `lucide-react`
- Animações via `framer-motion` (AnimatePresence, motion.div)
- Classe merge via `cn()` de `@/lib/utils`
- Valores monetários: **SEMPRE** usar `Decimal.js`, nunca floats
- Debounce padrão: 350ms para campos de pesquisa
- Formatos de moeda: `pt-BR` com `R$`

---

## 3. Regras de Negócio Financeiras (Brasil)

### 3.1. Pagamento e Faturamento

- Pagamento pode ser no **final** da locação (não necessariamente no início) —
  obras atrasam frequentemente
- Boletos podem vencer quando a obra atrasa — necessário regenerar boletos
- Reajuste de contrato: quando cliente ultrapassa o valor do contrato, gera-se
  aditivo com novo boleto
- Nota fiscal já é enviada por e-mail automaticamente após contratação

### 3.2. Tributação

- **Tipos de documento**: CPF (pessoa física), CNPJ (pessoa jurídica), CNI
  (estrangeiro)
- **Alíquotas padrão**: CPF ~6%, CNPJ ~2.5%, CNI ~6%
- **ISS sobre locação pura**: Inconstitucional conforme Súmula Vinculante 31 do
  STF — campo `issExemptRental` no `FinancialSetting`
- **Operações mistas** (locação + serviço): ISS pode incidir sobre a parte de
  serviço
- **Regimes tributários**: Simples Nacional, Lucro Presumido, Lucro Real
- **ICMS**: Isento — locação não configura circulação de mercadoria
- **Retenção na fonte**: Não incide sobre locação pura (Solução de Consulta
  COSIT 410/2017)

### 3.3. Fluxo de Status dos Orçamentos

```
Pendente → Aprovado (pagamento confirmado) → Em Locação (ativo) → Concluído
    |                                                                   |
    └→ Rejeitado                                              Cancelado ←┘
```

### 3.4. Status de Faturamento (BillingStatus)

```
AWAITING_PAYMENT  →  PAID  (confirmação bancária)
       |                     |
       └→  UNPAID  ←────────┘ (se reverter)
                                    |
                              SETTLED (conciliação manual pelo admin)
```

---

## 4. Estrutura de Ficheiros Relevantes

```
app/
├── admin/
│   ├── admin-layout-client.tsx          # Layout com redirect FINANCIAL → /admin/financeiro
│   ├── layout.tsx                       # Server layout (metadata)
│   ├── financeiro/
│   │   └── page.tsx                     # Página financeira principal (2887 linhas)
│   └── orcamentos/
│       └── page.tsx                     # Página de orçamentos (com search)
├── api/
│   ├── admin/
│   │   ├── financial/
│   │   │   ├── entries/
│   │   │   │   ├── route.ts             # GET+POST (261 linhas) — requireFinancialAccess
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts         # GET/PUT/DELETE — requireFinancialAccess
│   │   │   │       ├── status/route.ts  # PATCH billing status — requireFinancialAccess
│   │   │   │       └── due-date/route.ts # PATCH vencimento — requireFinancialAccess
│   │   │   ├── aging/route.ts           # GET aging data (259 linhas) — requireFinancialAccess
│   │   │   ├── revenue/route.ts         # GET receita (199 linhas) — requireFinancialAccess
│   │   │   ├── calendar/route.ts        # GET eventos (114 linhas) — requireFinancialAccess
│   │   │   ├── settings/route.ts        # GET/PUT config (161 linhas) — requireFinancialAccess
│   │   │   └── export/route.ts          # GET export xlsx/pdf/csv (778 linhas) — requireFinancialAccess
│   │   └── quotes/
│   │       ├── route.ts                 # GET lista orçamentos (search em quoteCode, name, email, company, phone, legacyExternalCode)
│   │       └── [id]/
│   │           ├── generate-boleto/route.ts  # POST — requireRoles(['ADMIN','OPERATOR','FINANCIAL'])
│   │           ├── send-boleto/route.ts      # POST — requireRoles(['ADMIN','OPERATOR','FINANCIAL'])
│   │           └── adjustments/
│   │               └── route.ts              # GET+POST (JÁ EXISTE)
│   ├── payments/
│   │   ├── boleto/
│   │   │   ├── generate/route.ts        # POST gerar boleto via gateway
│   │   │   ├── verify/route.ts          # POST verificar pagamento
│   │   │   ├── webhook/route.ts         # POST webhook (idempotente via status comparison)
│   │   │   └── [id]/pdf/route.ts        # GET PDF do boleto
│   │   └── pix/
│   │       ├── route.ts                 # POST gerar PIX
│   │       └── webhook/route.ts         # POST webhook PIX
│   └── cron/
│       ├── verify-boleto-payments/route.ts  # CRON verificação automática
│       └── boleto-overdue-alerts/route.ts   # CRON alertas de vencimento

components/
├── admin/
│   ├── admin-sidebar.tsx                # Sidebar com filtro por role (nav items com roles[])
│   ├── admin-desktop-header.tsx
│   ├── admin-mobile-header.tsx
│   └── financial/
│       ├── AgingChart.tsx               # Gráfico de aging (110 linhas)
│       ├── ChartCard.tsx                # Wrapper para gráficos (165 linhas)
│       ├── DebtorsTable.tsx             # Tabela de devedores (119 linhas)
│       ├── KPICard.tsx                  # Card KPI animado (213 linhas)
│       ├── RevenueByCategoryChart.tsx   # Receita por categoria (88 linhas)
│       └── RevenueChart.tsx             # Evolução de receita (83 linhas)
└── ui/
    ├── HybridTooltip.tsx                # Tooltip mobile+desktop (interface: content, side, align, sideOffset, delayDuration)
    ├── status-tooltip.tsx               # Tooltip de status (interface: status, className, label)
    └── ... (button, card, dialog, select, etc.)

lib/
├── auth.ts                              # NextAuth config
├── prisma.ts                            # Prisma client singleton
├── permissions.ts                       # RBAC — hasPermission(role, module, action)
├── financial.ts                         # Utilitários financeiros (calculateNetAmount, resolveTaxDocumentType, etc.)
├── financial-scope.ts                   # Filtros de escopo (buildFinancialSearchFilter, buildFinancialPaymentsWhere)
├── quote-boleto.ts                      # Geração de boleto com advisory lock (ensureQuoteBoletoPayment)
├── tax-engine.ts                        # Motor de cálculo tributário
├── rate-limit.ts                        # Rate limiting
├── sanitize.ts                          # Sanitização HTML
├── audit-logger.ts                      # Logs de auditoria
└── utils.ts                             # cn(), debounce, etc.

middlewares/
└── require-admin.ts                     # requireAdmin, requireAdminOrOperator, requireFinancialAccess, requireRoles, requirePermission

prisma/
└── schema.prisma                        # Schema completo do banco
```

---

## 5. Sistema de Autorização (Estado Atual)

### 5.1. Middleware (`middlewares/require-admin.ts`)

O middleware já expõe estas funções:

```typescript
requireAdmin()               // → ['ADMIN']
requireAdminOrOperator()     // → ['ADMIN', 'OPERATOR']
requireFinancialAccess()     // → ['ADMIN', 'FINANCIAL']
requireRoles(roles: Role[])  // → roles customizadas
requirePermission(module, action) // → consulta tabela Permission
```

### 5.2. Permissões (`lib/permissions.ts`)

Módulos:
`EQUIPMENTS | QUOTES | RENTALS | FINANCIAL | MAINTENANCE | LOGISTICS | CONTRACTS | SETTINGS | USERS`

Ações: `READ | WRITE | DELETE | APPROVE | MANAGE`

Permissões padrão da role FINANCIAL:

- `FINANCIAL.READ` — pode ler dados financeiros
- `FINANCIAL.WRITE` — pode criar/editar lançamentos financeiros

A role ADMIN tem todas as permissões automaticamente.

### 5.3. Sidebar (`components/admin/admin-sidebar.tsx`)

Cada item de navegação tem um array `roles` que filtra a visibilidade:

```typescript
{ href: '/admin/financeiro', label: 'Financeiro', roles: ['ADMIN', 'FINANCIAL'] }
{ href: '/admin/equipamentos', label: 'Equipamentos', roles: ['ADMIN', 'OPERATOR'] }
{ href: '/admin/settings', label: 'Configurações', roles: ['ADMIN'] }
// ... etc
```

### 5.4. Redirect (`app/admin/admin-layout-client.tsx`)

Utilizadores com role FINANCIAL são redirecionados para `/admin/financeiro` se
tentarem acessar qualquer outra rota admin:

```typescript
if (
  userRole === "FINANCIAL" &&
  !pathname.startsWith("/admin/financeiro") &&
  pathname !== "/admin/login"
) {
  router.push("/admin/financeiro")
}
```

### 5.5. Estado Atual das APIs Financeiras

**TODAS** as rotas em `/api/admin/financial/**` já usam
`requireFinancialAccess()` — ou seja, permitem tanto ADMIN quanto FINANCIAL.
Isto já está correto.

---

## 6. Proteção Contra Boletos Duplicados (Estado Atual)

### 6.1. Backend (`lib/quote-boleto.ts`)

O backend JÁ tem proteção robusta contra duplicatas:

```
1. Transaction com advisory lock: pg_advisory_xact_lock(hashtext(quoteId))
2. Verifica boleto existente (PENDING, OVERDUE, PAID) para o mesmo quoteId
3. Se existir e valor bater → retorna existente (created: false)
4. Se valor diferir → cancela antigo no gateway e cria novo
5. Timeout da transação: maxWait 30s, timeout 60s
```

### 6.2. Rate Limiting nas Rotas Admin

- `generate-boleto/route.ts`: usa `strictRateLimit` (10 req/min)
- `send-boleto/route.ts`: usa `strictRateLimit` (10 req/min)

### 6.3. O Que Falta (Frontend)

O principal gap é no **frontend**: o botão de gerar boleto precisa de:

1. Estado `isGenerating` que desativa o botão após primeiro clique
2. Spinner visual durante a operação
3. Feedback via toast (sucesso/erro)
4. Opção de regenerar boleto vencido (novo botão contextual)

---

## 7. Detalhamento das 7 Tarefas

### TASK-1: RBAC Completo para Perfil Financeiro (PRIORIDADE CRÍTICA)

**Por que é crítico**: A secretária Adriana já estragou planilhas e relatórios
ao acessar funcionalidades fora do seu escopo. As permissões são CRÍTICAS.

**Estado atual**: O RBAC já está 95% implementado:

- ✅ Sidebar filtra por role
- ✅ Redirect de FINANCIAL para /admin/financeiro
- ✅ Todas as APIs financeiras usam requireFinancialAccess()
- ✅ Role FINANCIAL existe no enum

**O que falta implementar:**

1. **Verificar edge cases de navegação direta**: Garantir que middleware Next.js
   (se houver `middleware.ts` na raiz) também bloqueia FINANCIAL de acessar
   rotas fora do financeiro
2. **Testar todas as rotas de API de outros módulos**: Confirmar que
   `requireAdmin()` ou `requireAdminOrOperator()` é usado em TODAS as rotas de
   equipamentos, orçamentos, locações, manutenção, logística e configurações
3. **Adicionar badge visual no perfil**: Mostrar "Perfil: Financeiro" no header
   quando o utilizador é FINANCIAL
4. **Seed de permissões**: Garantir que `initializeDefaultPermissions()` é
   chamada no startup ou via migration

**Critérios de aceite:**

- Utilizador FINANCIAL só vê "Financeiro" no menu da sidebar
- Utilizador FINANCIAL é redirecionado para /admin/financeiro ao tentar qualquer
  outra URL admin
- Todas as APIs de outros módulos retornam 403 para role FINANCIAL
- O perfil FINANCIAL pode: ver lançamentos, editar status, exportar relatórios,
  ver dashboard financeiro
- O perfil FINANCIAL NÃO pode: ver/editar equipamentos, orçamentos, locações,
  manutenção, logística, configurações, utilizadores

---

### TASK-2: Corrigir Bug de Boletos Duplicados + Regeneração

**Por que é crítico**: Se clicar várias vezes no botão de gerar boleto, pode
gerar cobranças duplicadas ao cliente. Além disso, boletos vencem quando obras
atrasam.

**Estado atual do backend**: Protecção via advisory lock e verificação de boleto
existente JÁ EXISTE em `lib/quote-boleto.ts`. Rate limiting JÁ EXISTE nas rotas
admin.

**O que falta implementar:**

1. **Frontend — Proteção de clique múltiplo:**
   - Adicionar estado `isGenerating` no botão de gerar boleto
   - `disabled={isGenerating}` + spinner animado
   - Toast de sucesso/erro após conclusão
   - Ficheiro: onde quer que o botão "Gerar Boleto" esteja renderizado
     (provavelmente em `app/admin/orcamentos/page.tsx` ou num componente de
     detalhe do orçamento)

2. **API de Regeneração:**
   - Criar rota `PUT /api/payments/boleto/[id]/regenerate` que: a. Cancela
     boleto antigo (status = CANCELLED) b. Gera novo boleto com nova data de
     vencimento c. Atualiza Payment com novo transactionId
   - Auth: `requireFinancialAccess()` (admin e financeiro podem regenerar)

3. **UI de Regeneração:**
   - No detalhe do lançamento financeiro (modal em
     `app/admin/financeiro/page.tsx`), mostrar botão "Regenerar Boleto" quando:
     - `dueDate < now` (vencido)
     - `billingStatus !== 'PAID'` e `billingStatus !== 'SETTLED'`
   - Botão com confirmação: "O boleto atual será cancelado e um novo será
     gerado. Continuar?"

**Fluxo de regeneração:**

```
[Boleto Vencido] → Clique "Regenerar"
    → Confirma diálogo
    → PUT /api/payments/boleto/{id}/regenerate
    → Backend cancela boleto antigo no gateway (Asaas)
    → Backend cria novo Payment com nova dueDate
    → Backend gera novo boleto no gateway
    → Frontend atualiza lista + toast "Boleto regenerado com sucesso"
```

**Critérios de aceite:**

- Clicar múltiplas vezes no botão "Gerar Boleto" NÃO gera duplicatas
- Botão fica desativado com spinner durante processamento
- Boletos vencidos mostram opção "Regenerar"
- Regeneração cancela boleto antigo e cria novo com nova data
- Toast confirma operação bem-sucedida

---

### TASK-3: Reajuste de Orçamento com Categorias

**Por que é importante**: Quando o cliente ultrapassa o valor do contrato (obra
atrasa, equipamento fica mais tempo), é necessário gerar um aditivo com novo
valor e cobrar a diferença.

**Estado atual**:

- ✅ Model `QuoteAdjustment` existe no Prisma
- ✅ Enum `QuoteAdjustmentCategory` tem: `LABOR`, `TRAVEL`, `MAINTENANCE`,
  `OTHER`
- ✅ Rota API `GET/POST /api/admin/quotes/[id]/adjustments` JÁ EXISTE
- ✅ Quote tem relação `adjustments QuoteAdjustment[]`

**O que falta implementar:**

1. **UI — Modal de Reajuste** (na página de orçamentos
   `app/admin/orcamentos/page.tsx`):
   - Botão "Reajuste" visível em orçamentos com status APPROVED ou em locação
   - Modal/Dialog com:
     - Select para categoria: `Mão de Obra | Deslocamento | Manutenção | Outros`
     - Input numérico para valor em R$ (com máscara de moeda brasileira)
     - Textarea para justificativa (obrigatória, min 10 caracteres)
     - Checkbox "Gerar boleto para o valor do reajuste"
     - Checkbox "Enviar notificação ao cliente" (e-mail)
     - Botão "Aplicar Reajuste"

2. **Lógica de backend** (verificar se a rota existente já faz isso):
   - Criar QuoteAdjustment vinculado ao Quote
   - Recalcular `finalTotal` do Quote (soma original + todos os ajustes)
   - Se checkbox "Gerar boleto" ativado: gerar novo Payment do tipo LATE_FEE ou
     RENTAL com o valor do ajuste
   - Se checkbox "Notificar" ativado: enviar e-mail via Resend com detalhes do
     reajuste

3. **Histórico de Reajustes**:
   - Na página de detalhe do orçamento, mostrar lista de reajustes anteriores
   - Colunas: Data, Categoria, Valor, Justificativa, Criado por, E-mail enviado?

**Fluxo de reajuste:**

```
[Orçamento Aprovado] → Clique "Reajuste"
    → Preenche modal (categoria, valor, justificativa)
    → POST /api/admin/quotes/{id}/adjustments
    → Backend cria QuoteAdjustment
    → Backend recalcula finalTotal do Quote
    → (Opcional) Backend gera novo boleto para o delta
    → (Opcional) Backend envia e-mail ao cliente
    → Frontend atualiza dados + toast "Reajuste aplicado"
```

**Categorias traduzidas:** | Enum | Label PT-BR | Descrição |
|:-----|:------------|:----------| | LABOR | Mão de Obra | Custo de trabalho
adicional | | TRAVEL | Deslocamento | Ida e volta para entrega/recolha | |
MAINTENANCE | Manutenção | Reparos durante a locação | | OTHER | Outros | Custos
diversos (definidos por Gustavo) |

**Critérios de aceite:**

- Modal de reajuste acessível em orçamentos aprovados/em locação
- Categorias pré-definidas com select
- Justificativa obrigatória
- Recalcula total do orçamento
- Opcionalmente gera boleto e notifica cliente
- Histórico de reajustes visível no detalhe do orçamento

---

### TASK-4: Dashboard de Aging de Contas a Receber

**Por que é importante**: O financeiro precisa visualizar rapidamente quanto
está em atraso, por quanto tempo, e quem são os maiores devedores.

**Estado atual**:

- ✅ API `GET /api/admin/financial/aging` existe (259 linhas)
- ✅ Componente `AgingChart.tsx` existe (110 linhas) — usa Recharts BarChart
- ✅ Componente `DebtorsTable.tsx` existe (119 linhas) — tabela de maiores
  devedores
- ✅ Dashboard view existe na página financeira com viewMode === 'dashboard'

**O que falta implementar:**

1. **Melhorar faixas de aging com cores progressivas:**
   - A vencer (verde #16A34A)
   - 1-30 dias (amarelo #D97706)
   - 31-60 dias (laranja #EA580C)
   - 61-90 dias (vermelho #DC2626)
   - +90 dias (vermelho escuro #991B1B)

2. **KPI de inadimplência**: Card com percentual de valores vencidos sobre total
   a receber:

   ```
   Taxa de Inadimplência = (Valores Vencidos / Total a Receber) × 100%
   ```

3. **Alertas visuais no menu**: Badge vermelho no item "Financeiro" da sidebar
   quando há valores em atraso > 60 dias. Usar o sistema de `badgeKey` que já
   existe no `NavItem`:
   - Adicionar `badgeKey: 'financial'` ao item do Financeiro na sidebar
   - Criar endpoint ou lógica no `useAdminBadges()` que retorna contagem de
     alertas financeiros

4. **Destaque no dashboard**: Os componentes AgingChart e DebtorsTable devem
   aparecer em destaque na seção superior do dashboard financeiro, com cards
   visuais de KPI acima.

**Critérios de aceite:**

- Faixas de aging com cores progressivas (verde → vermelho escuro)
- KPI de inadimplência visível no dashboard
- Badge no menu "Financeiro" quando há atrasos severos
- DebtorsTable mostra top 5-10 devedores com valor e dias de atraso

---

### TASK-5: Tooltips/Legendas de Status

**Por que é importante**: Os utilizadores (especialmente Adriana) não entendem o
significado de cada status. Precisam de ícone com caixa explicativa.

**Estado atual**:

- ✅ Componente `HybridTooltip.tsx` existe (funciona em mobile e desktop)
- ✅ Componente `status-tooltip.tsx` existe
- ✅ Ícone `Info` disponível via `lucide-react`

**O que implementar:**

1. **Status de Faturamento** (na tabela e filtros da página financeira):

| Status           | Label                | Cor      | Tooltip                                                       |
| :--------------- | :------------------- | :------- | :------------------------------------------------------------ |
| PAID             | Pago                 | Verde    | "Pagamento confirmado e registrado no sistema"                |
| UNPAID           | Não Pago             | Vermelho | "Pagamento ainda não realizado. O boleto pode estar vencido." |
| AWAITING_PAYMENT | Aguardando Pagamento | Laranja  | "Boleto emitido, aguardando confirmação bancária"             |
| SETTLED          | Baixado              | Cinza    | "Pagamento conciliado manualmente pelo administrador"         |

2. **Status de Orçamentos** (na página de orçamentos):

| Status    | Label     | Cor      | Tooltip                                                     |
| :-------- | :-------- | :------- | :---------------------------------------------------------- |
| PENDING   | Pendente  | Amarelo  | "Orçamento recebido, aguardando análise e aprovação"        |
| APPROVED  | Aprovado  | Verde    | "Orçamento aprovado. Equipamento reservado para o cliente." |
| REJECTED  | Rejeitado | Vermelho | "Orçamento recusado pelo administrador ou pelo cliente"     |
| COMPLETED | Concluído | Azul     | "Locação finalizada com sucesso. Equipamento devolvido."    |

3. **Status de Locações**:

| Status    | Label     | Tooltip                                              |
| :-------- | :-------- | :--------------------------------------------------- |
| PENDING   | Pendente  | "Locação criada, aguardando início"                  |
| ACTIVE    | Ativo     | "Equipamento em uso pelo cliente"                    |
| COMPLETED | Concluído | "Equipamento devolvido, locação encerrada"           |
| CANCELLED | Cancelado | "Locação cancelada antes da conclusão"               |
| OVERDUE   | Atrasado  | "Data de devolução ultrapassada. Contactar cliente." |

**Implementação**: Usar o `HybridTooltip` existente com ícone
`<Info className="h-3.5 w-3.5 text-muted-foreground" />` ao lado de cada
badge/label de status.

**Critérios de aceite:**

- Ícone de info ao lado de cada status na tabela financeira
- Tooltip aparece ao hover (desktop) e tap (mobile)
- Texto descritivo em português brasileiro
- Aplicado em: tabela financeira, filtros de status, página de orçamentos

---

### TASK-6: Corrigir Campo de Pesquisa de Orçamentos

**Por que é importante**: Francisco reportou que "o campo de pesquisa de
orçamentos usa o ID do equipamento" em vez do código do orçamento.

**Estado atual investigado**:

- A API de orçamentos (`/api/admin/quotes/route.ts`) JÁ pesquisa em: `id`,
  `quoteCode`, `legacyExternalCode`, `name`, `email`, `phone`, `company`
- O placeholder da pesquisa JÁ diz: "Buscar por cliente, código do orçamento,
  e-mail..."
- O campo JÁ usa debounce de 350ms

**Possível causa do problema**: O utilizador pode estar confundindo o ID interno
(cuid) com o quoteCode, ou o quoteCode pode não estar preenchido para alguns
orçamentos antigos.

**O que verificar/implementar:**

1. **Verificar preenchimento de quoteCode**: Garantir que todos os orçamentos
   têm `quoteCode` preenchido. Se houver orçamentos sem quoteCode, criar um
   script de migração que gera códigos retroativamente (formato:
   `ORC-{ano}-{sequencial}`)

2. **Mostrar quoteCode de forma proeminente**: Na tabela/kanban de orçamentos, o
   quoteCode deve ser a primeira coluna visível — não o ID interno

3. **Adicionar `legacyExternalCode` à pesquisa visual**: Se o campo placeholder
   não menciona "código legado", adicionar ao placeholder

4. **Garantir case-insensitive**: A pesquisa já usa `mode: 'insensitive'` no
   Prisma

**Critérios de aceite:**

- Pesquisa por quoteCode (ex: "ORC-2026-001") encontra o orçamento correto
- Pesquisa por nome do cliente funciona
- Pesquisa por legacyExternalCode funciona
- quoteCode visível de forma proeminente na listagem
- Todos os orçamentos têm quoteCode preenchido

---

### TASK-7: Melhorar Exportação Excel com Identidade Visual e Novas Abas

**Por que é importante**: O relatório Excel atual é funcional mas básico — uma
única aba com cabeçalho azul. O cliente precisa de um relatório profissional com
múltiplas abas, gráficos e formatação condicional que possa ser apresentado a
stakeholders.

**Estado atual** (`app/api/admin/financial/export/route.ts` — 778 linhas):

- ✅ Suporta PDF, XLSX e CSV
- ✅ XLSX tem: título, subtítulo, resumo de totais, tabela com headers azuis,
  linhas alternadas, auto-filter, formatação de moeda
- ✅ PDF tem: cabeçalho, resumo, tabela multi-página, notas fiscais, paginação
- ✅ CSV tem: separador `;`, BOM UTF-8, escaping correto

**O que implementar no XLSX (expandir a função `buildXlsx`):**

1. **Identidade Visual da Marca:**
   - Cor primária: Laranja #F97316 (cabeçalhos principais)
   - Cor secundária: #1F2937 (textos)
   - Cor de destaque: Azul #1A56DB (links e totais)
   - Backgrounds: #FFF7ED (laranja claro), #F8FAFC (cinza claro)

2. **Aba "Resumo Executivo":**
   - KPIs em formato de cards (cells mescladas com fundo colorido):
     - Total Bruto, Total Líquido, Total Pago, Total Pendente, Nº de Lançamentos
   - Composição por status (com percentuais):
     - Pagos: X (Y%), Não Pagos: X (Y%), Aguardando: X (Y%), Baixados: X (Y%)
   - Cabeçalho com nome da empresa "GB Locações", período do relatório e data de
     geração

3. **Aba "Lançamentos Detalhados":**
   - Tabela completa existente COM formatação condicional por status:
     - PAID → fundo verde claro #DCFCE7
     - UNPAID → fundo vermelho claro #FEE2E2
     - AWAITING_PAYMENT → fundo amarelo claro #FEF3C7
     - SETTLED → fundo cinza claro #F1F5F9
   - Colunas adicionais: Tipo de Operação, Regime Tributário, Valor ISS

4. **Aba "Contas a Receber" (Aging):**
   - Tabela de aging por faixas: A vencer, 1-30, 31-60, 61-90, +90 dias
   - Para cada faixa: quantidade, valor total, percentual do total
   - Abaixo: tabela dos maiores devedores (top 10)

5. **Aba "Análise Tributária":**
   - Resumo por tipo de documento (CPF vs CNPJ):
     - Quantidade de lançamentos
     - Valor bruto total
     - Valor líquido total
     - Alíquota média
     - Imposto retido total
   - Resumo por regime tributário

6. **Formatação Global:**
   - Linhas alternadas em todas as tabelas
   - Filtros automáticos em todas as tabelas
   - Colunas auto-dimensionadas
   - Cabeçalho da empresa em todas as abas
   - Rodapé: "Gerado em DD/MM/YYYY HH:MM — GB Locações © 2026"
   - Configuração de impressão: paisagem, ajustar à largura

**Critérios de aceite:**

- Excel com 4+ abas (Resumo, Lançamentos, Aging, Tributário)
- Identidade visual com cores da marca
- Formatação condicional por status
- KPIs na aba de resumo
- Aging com faixas e devedores
- Análise tributária por tipo de documento
- Pronto para impressão profissional

---

## 8. Componentes UI Existentes Reutilizáveis

Ao implementar as tarefas, reutilizar estes componentes existentes:

| Componente      | Ficheiro                                      | Uso                         |
| :-------------- | :-------------------------------------------- | :-------------------------- |
| `HybridTooltip` | `components/ui/HybridTooltip.tsx`             | Tooltips mobile+desktop     |
| `KPICard`       | `components/admin/financial/KPICard.tsx`      | Cards de KPI animados       |
| `AgingChart`    | `components/admin/financial/AgingChart.tsx`   | Gráfico de aging            |
| `DebtorsTable`  | `components/admin/financial/DebtorsTable.tsx` | Tabela de devedores         |
| `ChartCard`     | `components/admin/financial/ChartCard.tsx`    | Wrapper para gráficos       |
| `RevenueChart`  | `components/admin/financial/RevenueChart.tsx` | Gráfico de receita          |
| `AdminCard`     | `components/admin/AdminCard.tsx` (ou similar) | Card genérico admin         |
| `Button`        | `components/ui/button.tsx`                    | Botão com variantes (Radix) |
| `Dialog`        | `components/ui/dialog.tsx`                    | Modal (Radix)               |
| `Select`        | `components/ui/select.tsx`                    | Select dropdown (Radix)     |
| `useDebounce`   | `hooks/use-debounce.ts`                       | Hook de debounce            |
| `cn()`          | `lib/utils.ts`                                | Merge de classes Tailwind   |

---

## 9. Modelo de Dados Python para Referência do Excel (Script Independente)

O utilizador também forneceu um script Python com `openpyxl` que serve como
**referência visual** para o relatório Excel desejado. As cores, layout e
estrutura de abas desse script devem ser usadas como inspiração para a
implementação em ExcelJS no Next.js. As cores da paleta estão definidas na seção
de identidade visual acima.

---

## 10. Ordem de Implementação Recomendada

```
T1 (RBAC) → T5 (Tooltips) → T6 (Search Fix) → T2 (Boletos) → T3 (Reajustes) → T4 (Aging Dashboard) → T7 (Export Excel)
```

**Justificativa**:

- T1 é CRÍTICA e base para tudo (segurança)
- T5 e T6 são rápidas e melhoram UX imediatamente
- T2 resolve um bug real de produção
- T3 é funcionalidade nova com dependência no backend existente
- T4 melhora visualização existente
- T7 é a mais complexa e pode ser feita por último

</CONTEXTO_EM_TEXTO>

<CONTEXTO*EM_JSON> { "projectMeta": { "name": "GB Locações SaaS", "description":
"Plataforma SaaS brasileira de gestão de locação de equipamentos para construção
civil, com módulos de equipamentos, orçamentos, locações, financeiro,
manutenção, logística e admin.", "repository": "Schlorke/GB-Locacoes",
"website": "locacoesgb.com.br", "language": "pt-BR", "stack": { "framework":
"Next.js 16.1.6 (App Router, Turbopack)", "orm": "Prisma 7.4.0 (PostgreSQL)",
"ui": "React 19.2.4, Radix UI, TailwindCSS 3.4.17", "charts": "Recharts 3.7.0",
"auth": "NextAuth.js 4.24.13 (JWT, Google OAuth)", "excel": "ExcelJS 4.4.0",
"pdf": "pdfkit", "animations": "Framer Motion 12.34.2", "validation": "Zod
4.3.6", "dates": "date-fns 4.1.0", "icons": "Lucide React 0.574.0", "toasts":
"Sonner", "stateManagement": "Zustand, React Hook Form", "packageManager": "pnpm
10+" }, "conventions": { "pathAlias": "@/*", "componentLibrary": "Radix UI",
"animations": "Framer Motion", "toasts": "Sonner", "icons": "Lucide React",
"validation": "Zod", "dates": "date-fns", "currency": "Decimal.js (NUNCA
floats)", "classMerge": "cn() de @/lib/utils", "debounce": "350ms para campos de
pesquisa", "apiRouteHeaders": "dynamic = 'force-dynamic', runtime = 'nodejs',
revalidate = 0" } }, "fileMap": { "description": "Mapa completo de ficheiros
relevantes com caminhos relativos à raiz do projeto.", "critical": [
"app/admin/financeiro/page.tsx", "app/admin/admin-layout-client.tsx",
"app/admin/orcamentos/page.tsx", "components/admin/admin-sidebar.tsx",
"middlewares/require-admin.ts", "lib/permissions.ts", "lib/financial.ts",
"lib/financial-scope.ts", "lib/quote-boleto.ts", "lib/tax-engine.ts",
"prisma/schema.prisma" ], "apis": [ "app/api/admin/financial/entries/route.ts",
"app/api/admin/financial/entries/[id]/route.ts",
"app/api/admin/financial/entries/[id]/status/route.ts",
"app/api/admin/financial/entries/[id]/due-date/route.ts",
"app/api/admin/financial/aging/route.ts",
"app/api/admin/financial/revenue/route.ts",
"app/api/admin/financial/calendar/route.ts",
"app/api/admin/financial/settings/route.ts",
"app/api/admin/financial/export/route.ts", "app/api/admin/quotes/route.ts",
"app/api/admin/quotes/[id]/generate-boleto/route.ts",
"app/api/admin/quotes/[id]/send-boleto/route.ts",
"app/api/admin/quotes/[id]/adjustments/route.ts",
"app/api/payments/boleto/generate/route.ts",
"app/api/payments/boleto/verify/route.ts",
"app/api/payments/boleto/webhook/route.ts",
"app/api/payments/boleto/[id]/pdf/route.ts", "app/api/payments/pix/route.ts",
"app/api/payments/pix/webhook/route.ts",
"app/api/cron/verify-boleto-payments/route.ts",
"app/api/cron/boleto-overdue-alerts/route.ts" ], "components": [
"components/admin/admin-sidebar.tsx",
"components/admin/admin-desktop-header.tsx",
"components/admin/admin-mobile-header.tsx",
"components/admin/financial/AgingChart.tsx",
"components/admin/financial/ChartCard.tsx",
"components/admin/financial/DebtorsTable.tsx",
"components/admin/financial/KPICard.tsx",
"components/admin/financial/RevenueByCategoryChart.tsx",
"components/admin/financial/RevenueChart.tsx",
"components/ui/HybridTooltip.tsx", "components/ui/status-tooltip.tsx",
"components/ui/button.tsx", "components/ui/card.tsx",
"components/ui/dialog.tsx", "components/ui/select.tsx" ], "middleware": [
"middlewares/require-admin.ts", "lib/permissions.ts", "lib/auth.ts" ], "tests":
[ "tests/critical/financial-due-date.test.ts",
"tests/critical/financial-entries.test.ts",
"tests/critical/financial-revenue.test.ts",
"tests/critical/payment-processor.test.ts" ], "utilities": [ "lib/financial.ts",
"lib/financial-scope.ts", "lib/quote-boleto.ts", "lib/tax-engine.ts",
"lib/rate-limit.ts", "lib/sanitize.ts", "lib/audit-logger.ts", "lib/utils.ts",
"lib/prisma.ts" ] }, "databaseSchema": { "models": [ { "name": "Payment",
"tableName": "Payment", "fields": [ { "name": "id", "type": "String",
"attributes": "@id @default(cuid())" }, { "name": "rentalId", "type": "String?",
"attributes": "" }, { "name": "quoteId", "type": "String?", "attributes": "" },
{ "name": "amount", "type": "Decimal", "attributes": "@db.Decimal" }, { "name":
"method", "type": "PaymentMethod", "attributes": "" }, { "name": "status",
"type": "PaymentStatus", "attributes": "@default(PENDING)" }, { "name":
"billingStatus", "type": "PaymentBillingStatus", "attributes":
"@default(AWAITING_PAYMENT)" }, { "name": "type", "type": "PaymentType",
"attributes": "@default(RENTAL)" }, { "name": "paidAt", "type": "DateTime?",
"attributes": "@db.Timestamp(6)" }, { "name": "dueDate", "type": "DateTime",
"attributes": "@db.Timestamp(6)" }, { "name": "grossAmount", "type": "Decimal?",
"attributes": "@db.Decimal" }, { "name": "netAmount", "type": "Decimal?",
"attributes": "@db.Decimal" }, { "name": "taxRate", "type": "Decimal?",
"attributes": "@db.Decimal" }, { "name": "taxDocumentType", "type":
"TaxDocumentType?", "attributes": "" }, { "name": "invoiceNumber", "type":
"String?", "attributes": "" }, { "name": "boletoIssuedAt", "type": "DateTime?",
"attributes": "" }, { "name": "invoiceIssuedAt", "type": "DateTime?",
"attributes": "" }, { "name": "settledAt", "type": "DateTime?", "attributes": ""
}, { "name": "transactionId", "type": "String?", "attributes": "" }, { "name":
"pixCode", "type": "String?", "attributes": "" }, { "name": "pixQrCode", "type":
"String?", "attributes": "" }, { "name": "metadata", "type": "Json?",
"attributes": "" }, { "name": "operationType", "type": "OperationType?",
"attributes": "" }, { "name": "rentalAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "serviceAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "taxRegimeSnapshot", "type": "TaxRegime?",
"attributes": "" }, { "name": "issAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "irpjAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "csllAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "pisCofinsAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "simplesAmount", "type": "Decimal?", "attributes":
"@db.Decimal" }, { "name": "nfseNumber", "type": "String?", "attributes": "" },
{ "name": "nfseIssuedAt", "type": "DateTime?", "attributes": "" }, { "name":
"taxBreakdown", "type": "Json?", "attributes": "" }, { "name": "createdAt",
"type": "DateTime", "attributes": "@default(now())" }, { "name": "updatedAt",
"type": "DateTime", "attributes": "@updatedAt" } ], "relations": [ { "field":
"quote", "model": "Quote", "type": "belongsTo", "foreignKey": "quoteId" }, {
"field": "rental", "model": "rentals", "type": "belongsTo", "foreignKey":
"rentalId" } ], "indexes": ["@@index([rentalId])", "@@index([quoteId])"] }, {
"name": "Quote", "tableName": "quotes", "fields": [ { "name": "id", "type":
"String", "attributes": "@id @default(cuid())" }, { "name": "quoteCode", "type":
"String?", "attributes": "@unique" }, { "name": "legacyExternalCode", "type":
"String?", "attributes": "" }, { "name": "name", "type": "String", "attributes":
"" }, { "name": "email", "type": "String", "attributes": "" }, { "name":
"phone", "type": "String", "attributes": "" }, { "name": "company", "type":
"String?", "attributes": "" }, { "name": "message", "type": "String?",
"attributes": "" }, { "name": "total", "type": "Decimal", "attributes":
"@default(0)" }, { "name": "status", "type": "QuoteStatus", "attributes":
"@default(PENDING)" }, { "name": "userId", "type": "String?", "attributes": ""
}, { "name": "clientDeletedAt", "type": "DateTime?", "attributes": "" }, {
"name": "createdAt", "type": "DateTime", "attributes": "@default(now())" }, {
"name": "updatedAt", "type": "DateTime", "attributes": "@updatedAt" }, { "name":
"cep", "type": "String?", "attributes": "" }, { "name": "cnpj", "type":
"String?", "attributes": "" }, { "name": "cpf", "type": "String?", "attributes":
"" }, { "name": "adminNotes", "type": "String?", "attributes": "" }, { "name":
"approvedAt", "type": "DateTime?", "attributes": "" }, { "name": "approvedBy",
"type": "String?", "attributes": "" }, { "name": "convertedToRentalId", "type":
"String?", "attributes": "" }, { "name": "paymentTerms", "type":
"QuotePaymentTerms", "attributes": "@default(UPFRONT)" }, { "name":
"deliveryAddress", "type": "Json?", "attributes": "" }, { "name": "deliveryFee",
"type": "Decimal?", "attributes": "" }, { "name": "deliveryType", "type":
"DeliveryType?", "attributes": "" }, { "name": "deposit", "type": "Decimal?",
"attributes": "" }, { "name": "discount", "type": "Decimal?", "attributes": ""
}, { "name": "endDate", "type": "DateTime?", "attributes": "" }, { "name":
"finalTotal", "type": "Decimal?", "attributes": "" }, { "name": "internalNotes",
"type": "String?", "attributes": "" }, { "name": "pickupFee", "type":
"Decimal?", "attributes": "" }, { "name": "priority", "type": "Int?",
"attributes": "@default(0)" }, { "name": "rejectedAt", "type": "DateTime?",
"attributes": "" }, { "name": "rejectedBy", "type": "String?", "attributes": ""
}, { "name": "rejectionReason", "type": "String?", "attributes": "" }, { "name":
"startDate", "type": "DateTime?", "attributes": "" }, { "name": "subtotal",
"type": "Decimal?", "attributes": "" }, { "name": "taxes", "type": "Decimal?",
"attributes": "" }, { "name": "validUntil", "type": "DateTime?", "attributes":
"" }, { "name": "originalTotal", "type": "Decimal?", "attributes": "" }, {
"name": "priceAdjustmentReason", "type": "String?", "attributes": "" }, {
"name": "priceAdjustedAt", "type": "DateTime?", "attributes": "" }, { "name":
"priceAdjustedBy", "type": "String?", "attributes": "" }, { "name": "lateFee",
"type": "Decimal?", "attributes": "" }, { "name": "lateFeeApproved", "type":
"Boolean?", "attributes": "@default(false)" }, { "name": "lateFeeApprovedAt",
"type": "DateTime?", "attributes": "" }, { "name": "lateFeeApprovedBy", "type":
"String?", "attributes": "" }, { "name": "damages", "type": "Json?",
"attributes": "" }, { "name": "misuse", "type": "Json?", "attributes": "" }, {
"name": "operationType", "type": "OperationType?", "attributes": "" }, { "name":
"serviceAmount", "type": "Decimal?", "attributes": "@db.Decimal" } ],
"relations": [ { "field": "adjustments", "model": "QuoteAdjustment", "type":
"hasMany" }, { "field": "payments", "model": "Payment", "type": "hasMany" }, {
"field": "items", "model": "QuoteItem", "type": "hasMany" }, { "field": "user",
"model": "User", "type": "belongsTo", "foreignKey": "userId" }, { "field":
"rentals", "model": "rentals", "type": "hasMany" } ], "indexes":
["@@index([userId])", "@@index([endDate])", "@@index([status])"] }, { "name":
"User", "tableName": "users", "fields": [ { "name": "id", "type": "String",
"attributes": "@id @default(cuid())" }, { "name": "name", "type": "String?",
"attributes": "" }, { "name": "email", "type": "String", "attributes": "@unique"
}, { "name": "password", "type": "String?", "attributes": "" }, { "name":
"role", "type": "Role", "attributes": "@default(CLIENT)" }, { "name":
"emailVerified", "type": "DateTime?", "attributes": "" }, { "name": "image",
"type": "String?", "attributes": "" }, { "name": "createdAt", "type":
"DateTime", "attributes": "@default(now())" }, { "name": "updatedAt", "type":
"DateTime", "attributes": "@updatedAt" }, { "name": "cnpj", "type": "String?",
"attributes": "@unique" }, { "name": "cpf", "type": "String?", "attributes":
"@unique" }, { "name": "phone", "type": "String?", "attributes": "" }, { "name":
"company", "type": "String?", "attributes": "" } ], "relations": [ { "field":
"quotes", "model": "Quote", "type": "hasMany" }, { "field": "rentals", "model":
"rentals", "type": "hasMany" }, { "field": "quoteAdjustments", "model":
"QuoteAdjustment", "type": "hasMany" } ] }, { "name": "FinancialSetting",
"tableName": "financial*settings", "fields": [ { "name": "id", "type": "String",
"attributes": "@id @default(cuid())" }, { "name": "cpfRate", "type": "Decimal",
"attributes": "@default(6.0) @db.Decimal" }, { "name": "cnpjRate", "type":
"Decimal", "attributes": "@default(2.5) @db.Decimal" }, { "name": "cniRate",
"type": "Decimal", "attributes": "@default(6.0) @db.Decimal" }, { "name":
"updatedBy", "type": "String?", "attributes": "" }, { "name": "createdAt",
"type": "DateTime", "attributes": "@default(now())" }, { "name": "updatedAt",
"type": "DateTime", "attributes": "@updatedAt" }, { "name": "taxRegime", "type":
"TaxRegime", "attributes": "@default(SIMPLES_NACIONAL)" }, { "name": "issRate",
"type": "Decimal", "attributes": "@default(2.5) @db.Decimal" }, { "name":
"issExemptRental", "type": "Boolean", "attributes": "@default(true)" }, {
"name": "irpjPresumidoRate", "type": "Decimal?", "attributes": "@db.Decimal" },
{ "name": "csllPresumidoRate", "type": "Decimal?", "attributes": "@db.Decimal"
}, { "name": "pisCofinsRate", "type": "Decimal?", "attributes": "@db.Decimal" },
{ "name": "simplesAnexo", "type": "String?", "attributes": "@default(\"III\")"
}, { "name": "simplesAliquota", "type": "Decimal?", "attributes": "@db.Decimal"
}, { "name": "ibsCbsRate", "type": "Decimal?", "attributes": "@db.Decimal" }, {
"name": "ibsCbsActive", "type": "Boolean", "attributes": "@default(false)" } ],
"relations": [ { "field": "updatedByUser", "model": "User", "type": "belongsTo",
"foreignKey": "updatedBy" } ] }, { "name": "Permission", "tableName":
"permissions", "fields": [ { "name": "id", "type": "String", "attributes": "@id
@default(cuid())" }, { "name": "role", "type": "Role", "attributes": "" }, {
"name": "module", "type": "String", "attributes": "" }, { "name": "action",
"type": "String", "attributes": "" }, { "name": "createdAt", "type": "DateTime",
"attributes": "@default(now())" }, { "name": "updatedAt", "type": "DateTime",
"attributes": "@updatedAt" } ], "uniqueConstraints": ["@@unique([role, module,
action])"] }, { "name": "QuoteAdjustment", "tableName": "quote_adjustments",
"fields": [ { "name": "id", "type": "String", "attributes": "@id
@default(cuid())" }, { "name": "quoteId", "type": "String", "attributes": "" },
{ "name": "category", "type": "QuoteAdjustmentCategory", "attributes": "" }, {
"name": "amount", "type": "Decimal", "attributes": "@db.Decimal" }, { "name":
"justification", "type": "String", "attributes": "" }, { "name": "sentEmailAt",
"type": "DateTime?", "attributes": "" }, { "name": "sentEmailTo", "type":
"String?", "attributes": "" }, { "name": "sentWhatsappAt", "type": "DateTime?",
"attributes": "" }, { "name": "sentWhatsappTo", "type": "String?", "attributes":
"" }, { "name": "createdBy", "type": "String", "attributes": "" }, { "name":
"createdAt", "type": "DateTime", "attributes": "@default(now())" }, { "name":
"updatedAt", "type": "DateTime", "attributes": "@updatedAt" } ], "relations": [
{ "field": "quote", "model": "Quote", "type": "belongsTo", "foreignKey":
"quoteId", "onDelete": "Cascade" }, { "field": "createdByUser", "model": "User",
"type": "belongsTo", "foreignKey": "createdBy", "onDelete": "Restrict" } ],
"indexes": ["@@index([quoteId])", "@@index([createdBy])"] } ], "enums": [ {
"name": "Role", "values": ["ADMIN", "FINANCIAL", "OPERATOR", "CLIENT"] }, {
"name": "PaymentBillingStatus", "values": ["PAID", "UNPAID", "AWAITING_PAYMENT",
"SETTLED"] }, { "name": "PaymentStatus", "values": ["PENDING", "PAID",
"OVERDUE", "CANCELLED", "REFUNDED"] }, { "name": "PaymentMethod", "values":
["PIX", "CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "CASH", "BOLETO"] }, {
"name": "PaymentType", "values": ["RENTAL", "DEPOSIT", "FINE", "DAMAGE",
"LATE_FEE"] }, { "name": "TaxDocumentType", "values": ["CPF", "CNPJ", "CNI"] },
{ "name": "TaxRegime", "values": ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO",
"LUCRO_REAL"] }, { "name": "OperationType", "values": ["PURE_RENTAL",
"RENTAL_WITH_SERVICE"] }, { "name": "QuoteAdjustmentCategory", "values":
["LABOR", "TRAVEL", "MAINTENANCE", "OTHER"] }, { "name": "QuoteStatus",
"values": ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] }, { "name":
"QuotePaymentTerms", "values": ["UPFRONT", "ON_DELIVERY", "AT_END"] } ] },
"frontendTypes": { "BillingStatus": "'PAID' | 'UNPAID' | 'AWAITING_PAYMENT' |
'SETTLED'", "FinancialEntry": { "id": "string", "rentalId": "string | null",
"quoteId": "string | null", "quoteCode": "string | null", "legacyExternalCode":
"string | null", "customerName": "string", "customerEmail": "string | null",
"customerDocument": "string", "grossAmount": "number", "netAmount": "number",
"taxRate": "number", "taxDocumentType": "'CPF' | 'CNPJ' | 'CNI'",
"invoiceNumber": "string | null", "boletoIssuedAt": "string | null",
"invoiceIssuedAt": "string | null", "dueDate": "string", "paidAt": "string |
null", "settledAt": "string | null", "billingStatus": "BillingStatus",
"operationType": "string | null", "rentalAmount": "number | null",
"serviceAmount": "number | null", "taxRegimeSnapshot": "string | null",
"issAmount": "number | null", "irpjAmount": "number | null", "csllAmount":
"number | null", "pisCofinsAmount": "number | null", "simplesAmount": "number |
null", "taxBreakdown": "Array<{ label: string; baseAmount: string; rate: string;
amount: string; exempt: boolean }> | null" }, "FinancialSettings": { "cpfRate":
"number", "cnpjRate": "number", "cniRate": "number", "taxRegime": "TaxRegime",
"issRate": "number", "issExemptRental": "boolean", "irpjPresumidoRate": "number
| null", "csllPresumidoRate": "number | null", "pisCofinsRate": "number | null",
"simplesAliquota": "number | null", "ibsCbsRate": "number | null",
"ibsCbsActive": "boolean" }, "FinancialTotals": { "gross": "number", "net":
"number", "paid": "number", "paidNet": "number", "paidCount": "number",
"unpaid": "number", "unpaidCount": "number", "awaiting": "number",
"awaitingCount": "number", "count": "number" }, "AgingData": { "range":
"string", "amount": "number", "count": "number", "status": "'onTime' |
'slightDelay' | 'severeDelay'" }, "Debtor": { "clientName": "string",
"overdueAmount": "number", "daysOverdue": "number", "status": "'overdue' |
'attention' | 'critical'" }, "RevenueData": { "month": "string", "revenue":
"number" }, "CategoryRevenue": { "categoryName": "string", "revenue": "number" }
}, "existingAuth": { "middleware": { "path": "middlewares/require-admin.ts",
"lineCount": 79, "functions": [ { "name": "requireAdmin", "roles": ["ADMIN"],
"description": "Apenas administradores" }, { "name": "requireAdminOrOperator",
"roles": ["ADMIN", "OPERATOR"], "description": "Administradores e operadores" },
{ "name": "requireFinancialAccess", "roles": ["ADMIN", "FINANCIAL"],
"description": "Administradores e financeiro" }, { "name": "requireRoles",
"roles": "dinâmico", "description": "Roles customizadas passadas como parâmetro"
}, { "name": "requirePermission", "roles": "dinâmico", "description": "Verifica
permissão específica na tabela Permission" } ] }, "permissions": { "path":
"lib/permissions.ts", "lineCount": 130, "modules": ["EQUIPMENTS", "QUOTES",
"RENTALS", "FINANCIAL", "MAINTENANCE", "LOGISTICS", "CONTRACTS", "SETTINGS",
"USERS"], "actions": ["READ", "WRITE", "DELETE", "APPROVE", "MANAGE"],
"defaultPermissions": { "FINANCIAL": [ { "module": "FINANCIAL", "action": "READ"
}, { "module": "FINANCIAL", "action": "WRITE" } ], "CLIENT": [ { "module":
"RENTALS", "action": "READ" }, { "module": "QUOTES", "action": "READ" }, {
"module": "CONTRACTS", "action": "READ" } ], "OPERATOR": [ { "module": "QUOTES",
"action": "READ" }, { "module": "RENTALS", "action": "READ" } ] } }, "sidebar":
{ "path": "components/admin/admin-sidebar.tsx", "description": "Filtra navItems
por session.user.role com array roles[]", "financialOnlyItems":
["/admin/financeiro"], "adminOnlyItems": ["/admin/settings"] },
"layoutRedirect": { "path": "app/admin/admin-layout-client.tsx", "description":
"FINANCIAL users redirected to /admin/financeiro if accessing other admin
routes", "code": "if (userRole === 'FINANCIAL' &&
!pathname.startsWith('/admin/financeiro')) router.push('/admin/financeiro')" }
}, "apiEndpoints": [ { "method": "GET", "route": "/api/admin/financial/entries",
"file": "app/api/admin/financial/entries/route.ts", "auth":
"requireFinancialAccess", "description": "Lista lançamentos financeiros com
filtros (search, status, startDate, endDate, page, limit)", "lineCount": 261 },
{ "method": "POST", "route": "/api/admin/financial/entries", "file":
"app/api/admin/financial/entries/route.ts", "auth": "requireFinancialAccess",
"description": "Cria novo lançamento financeiro" }, { "method": "GET", "route":
"/api/admin/financial/entries/[id]", "file":
"app/api/admin/financial/entries/[id]/route.ts", "auth":
"requireFinancialAccess", "description": "Obtém lançamento individual" }, {
"method": "PUT", "route": "/api/admin/financial/entries/[id]", "file":
"app/api/admin/financial/entries/[id]/route.ts", "auth":
"requireFinancialAccess", "description": "Atualiza lançamento individual" }, {
"method": "DELETE", "route": "/api/admin/financial/entries/[id]", "file":
"app/api/admin/financial/entries/[id]/route.ts", "auth":
"requireFinancialAccess", "description": "Remove lançamento individual" }, {
"method": "PATCH", "route": "/api/admin/financial/entries/[id]/status", "file":
"app/api/admin/financial/entries/[id]/status/route.ts", "auth":
"requireFinancialAccess", "description": "Atualiza billing status
(PAID/UNPAID/AWAITING_PAYMENT/SETTLED)", "lineCount": 108 }, { "method":
"PATCH", "route": "/api/admin/financial/entries/[id]/due-date", "file":
"app/api/admin/financial/entries/[id]/due-date/route.ts", "auth":
"requireFinancialAccess", "description": "Atualiza data de vencimento do
lançamento", "lineCount": 157 }, { "method": "GET", "route":
"/api/admin/financial/aging", "file": "app/api/admin/financial/aging/route.ts",
"auth": "requireFinancialAccess", "description": "Dados de aging de contas a
receber (faixas, devedores, totais)", "lineCount": 259 }, { "method": "GET",
"route": "/api/admin/financial/revenue", "file":
"app/api/admin/financial/revenue/route.ts", "auth": "requireFinancialAccess",
"description": "Dados de receita mensal e por categoria de equipamento",
"lineCount": 199 }, { "method": "GET", "route": "/api/admin/financial/calendar",
"file": "app/api/admin/financial/calendar/route.ts", "auth":
"requireFinancialAccess", "description": "Eventos para visualização calendário
(vencimentos, pagamentos)", "lineCount": 114 }, { "method": "GET", "route":
"/api/admin/financial/settings", "file":
"app/api/admin/financial/settings/route.ts", "auth": "requireFinancialAccess",
"description": "Obtém configurações tributárias", "lineCount": 161 }, {
"method": "PUT", "route": "/api/admin/financial/settings", "file":
"app/api/admin/financial/settings/route.ts", "auth": "requireFinancialAccess",
"description": "Atualiza configurações tributárias" }, { "method": "GET",
"route": "/api/admin/financial/export", "file":
"app/api/admin/financial/export/route.ts", "auth": "requireFinancialAccess",
"description": "Exportação em PDF, XLSX ou CSV com filtros e IDs selecionados",
"lineCount": 778 }, { "method": "GET", "route": "/api/admin/quotes", "file":
"app/api/admin/quotes/route.ts", "auth": "requireAdminOrOperator",
"description": "Lista orçamentos com pesquisa em id, quoteCode,
legacyExternalCode, name, email, phone, company" }, { "method": "POST", "route":
"/api/admin/quotes/[id]/generate-boleto", "file":
"app/api/admin/quotes/[id]/generate-boleto/route.ts", "auth":
"requireRoles(['ADMIN','OPERATOR','FINANCIAL'])", "description": "Gera boleto
para orçamento. Rate limited (10/min). Usa lib/quote-boleto.ts com advisory
lock." }, { "method": "POST", "route": "/api/admin/quotes/[id]/send-boleto",
"file": "app/api/admin/quotes/[id]/send-boleto/route.ts", "auth":
"requireRoles(['ADMIN','OPERATOR','FINANCIAL'])", "description": "Envia boleto
por e-mail via Resend. Rate limited (10/min)." }, { "method": "GET", "route":
"/api/admin/quotes/[id]/adjustments", "file":
"app/api/admin/quotes/[id]/adjustments/route.ts", "auth":
"requireAdminOrOperator (verificar)", "description": "Lista ajustes/reajustes de
um orçamento" }, { "method": "POST", "route":
"/api/admin/quotes/[id]/adjustments", "file":
"app/api/admin/quotes/[id]/adjustments/route.ts", "auth":
"requireAdminOrOperator (verificar)", "description": "Cria novo ajuste/reajuste
com categoria, valor e justificativa" }, { "method": "POST", "route":
"/api/payments/boleto/generate", "file":
"app/api/payments/boleto/generate/route.ts", "auth": "session (any
authenticated)", "description": "Gera boleto via gateway de pagamentos (Asaas)"
}, { "method": "POST", "route": "/api/payments/boleto/verify", "file":
"app/api/payments/boleto/verify/route.ts", "auth": "requireAdmin",
"description": "Verifica status do boleto no gateway" }, { "method": "POST",
"route": "/api/payments/boleto/webhook", "file":
"app/api/payments/boleto/webhook/route.ts", "auth": "HMAC signature / Bearer
token", "description": "Webhook do Asaas. Idempotente via comparação de status."
}, { "method": "GET", "route": "/api/payments/boleto/[id]/pdf", "file":
"app/api/payments/boleto/[id]/pdf/route.ts", "auth": "session", "description":
"Download PDF do boleto" }, { "method": "POST", "route": "/api/payments/pix/",
"file": "app/api/payments/pix/route.ts", "auth": "session", "description": "Gera
código PIX para pagamento" }, { "method": "POST", "route":
"/api/payments/pix/webhook", "file": "app/api/payments/pix/webhook/route.ts",
"auth": "HMAC/Bearer", "description": "Webhook de confirmação PIX" }, {
"method": "GET", "route": "/api/cron/verify-boleto-payments", "file":
"app/api/cron/verify-boleto-payments/route.ts", "auth": "CRON_SECRET",
"description": "CRON: verifica pagamentos pendentes no gateway" }, { "method":
"GET", "route": "/api/cron/boleto-overdue-alerts", "file":
"app/api/cron/boleto-overdue-alerts/route.ts", "auth": "CRON_SECRET",
"description": "CRON: envia alertas de boletos próximos do vencimento e
vencidos" } ], "developmentTasks": [ { "id": "T1", "title": "Implementar RBAC
Completo para Perfil Financeiro", "priority": "CRITICAL", "complexity":
"MEDIUM", "businessContext": "A secretária Adriana já estragou planilhas e
relatórios ao acessar funcionalidades fora do seu escopo. O RBAC é a prioridade
número 1. As permissões são CRÍTICAS.", "existingCode": { "enum": "Role já tem
FINANCIAL no Prisma schema", "middleware": "requireFinancialAccess() já existe
em middlewares/require-admin.ts e retorna ['ADMIN', 'FINANCIAL']",
"permissions": "Tabela Permission tem FINANCIAL com READ e WRITE no módulo
FINANCIAL", "sidebar": "admin-sidebar.tsx já filtra navItems por role —
Financeiro: ['ADMIN','FINANCIAL']", "redirect": "admin-layout-client.tsx já
redireciona FINANCIAL para /admin/financeiro" }, "filesToModify": [
"app/api/admin/financial/entries/route.ts — verificar uso de
requireFinancialAccess (JÁ OK)", "app/api/admin/financial/aging/route.ts —
verificar (JÁ OK)", "app/api/admin/financial/revenue/route.ts — verificar (JÁ
OK)", "app/api/admin/financial/calendar/route.ts — verificar (JÁ OK)",
"app/api/admin/financial/export/route.ts — verificar (JÁ OK)",
"app/api/admin/financial/settings/route.ts — verificar GET usa READ, PUT usa
WRITE (JÁ OK com requireFinancialAccess)", "components/admin/admin-sidebar.tsx —
verificar que apenas Financeiro aparece para FINANCIAL (JÁ OK)",
"app/admin/admin-layout-client.tsx — verificar redirect (JÁ OK)", "Verificar
TODAS as rotas de outros módulos NÃO incluem FINANCIAL" ], "steps": [ { "step":
1, "action": "Auditar todas as rotas API em app/api/admin/ para garantir que
nenhuma rota fora de financial/ aceita role FINANCIAL", "file":
"app/api/admin/", "codeHint": "Grep por 'FINANCIAL' em todas as rotas API e
verificar que só aparece em financial/ e quotes/[id]/generate-boleto e
send-boleto" }, { "step": 2, "action": "Verificar que o middleware Next.js
(middleware.ts na raiz, se existir) também bloqueia FINANCIAL de acessar rotas
admin fora de /admin/financeiro", "file": "middleware.ts", "codeHint": "Se não
existir middleware.ts, o redirect no admin-layout-client.tsx é suficiente pois é
client-side" }, { "step": 3, "action": "Adicionar indicação visual de role no
header/perfil", "file": "components/admin/admin-desktop-header.tsx", "codeHint":
"Mostrar badge 'Financeiro' ao lado do nome quando session.user.role ===
'FINANCIAL'" }, { "step": 4, "action": "Garantir que
initializeDefaultPermissions() é chamada (verificar se existe seed script ou
migration)", "file": "prisma/seed.ts ou scripts/", "codeHint": "Verificar se a
função initializeDefaultPermissions() de lib/permissions.ts é invocada em algum
ponto" }, { "step": 5, "action": "Criar teste automatizado que verifica
permissões do FINANCIAL", "file": "tests/critical/rbac-financial.test.ts",
"codeHint": "Testar que APIs de equipamentos, orçamentos, locações retornam 403
para role FINANCIAL" } ], "acceptanceCriteria": [ "Utilizador com role FINANCIAL
só vê 'Financeiro' no menu da sidebar", "Utilizador FINANCIAL é redirecionado
para /admin/financeiro ao tentar qualquer outra URL admin", "Todas as APIs de
outros módulos retornam 403 para role FINANCIAL", "O perfil FINANCIAL pode: ver
lançamentos, editar status, exportar relatórios, ver dashboard financeiro", "O
perfil FINANCIAL NÃO pode: ver/editar equipamentos, orçamentos, locações,
manutenção, logística, configurações, utilizadores", "Badge visual 'Financeiro'
aparece no header para o perfil FINANCIAL" ] }, { "id": "T2", "title": "Corrigir
Bug de Boletos Duplicados + Regeneração de Boletos Vencidos", "priority":
"CRITICAL", "complexity": "MEDIUM", "businessContext": "Se clicar várias vezes
no botão Gerar Boleto pode gerar 3-4 boletos duplicados. Boletos vencem quando
obras atrasam e não há forma fácil de regenerar.", "existingCode": {
"backendDedup": "lib/quote-boleto.ts já tem advisory lock
(pg_advisory_xact_lock) e verifica boleto existente antes de criar novo",
"rateLimit": "generate-boleto/route.ts e send-boleto/route.ts usam
strictRateLimit (10 req/min)", "webhookIdempotency": "webhook/route.ts verifica
payment.status !== targetStatus antes de atualizar" }, "filesToModify": [
"Frontend: Componente onde botão 'Gerar Boleto' está renderizado (em
app/admin/orcamentos/ ou componente de detalhe)", "Nova rota:
app/api/payments/boleto/[id]/regenerate/route.ts",
"app/admin/financeiro/page.tsx — adicionar botão 'Regenerar Boleto' no modal de
detalhe" ], "steps": [ { "step": 1, "action": "Localizar o componente que
renderiza o botão 'Gerar Boleto' e adicionar proteção de clique múltiplo",
"file": "app/admin/orcamentos/page.tsx (ou componente inline)", "codeHint":
"const [isGenerating, setIsGenerating] = useState(false); <Button
disabled={isGenerating} onClick={async () => { setIsGenerating(true); try {
await fetch(...); toast.success('Boleto gerado'); } catch { toast.error('Erro');
} finally { setIsGenerating(false); } }}>{isGenerating ?
<Loader2 className='animate-spin' /> : 'Gerar Boleto'}</Button>" }, { "step": 2,
"action": "Criar rota de regeneração de boleto vencido", "file":
"app/api/payments/boleto/[id]/regenerate/route.ts", "codeHint": "PUT handler:
requireFinancialAccess() → find Payment by id → cancel old boleto on gateway →
create new Payment with new dueDate → generate new boleto on gateway → return
new payment data" }, { "step": 3, "action": "Adicionar botão 'Regenerar Boleto'
no modal de detalhe financeiro", "file": "app/admin/financeiro/page.tsx",
"codeHint": "No modal de selectedEntry, se dueDate < now && billingStatus não é
PAID/SETTLED, mostrar:
<Button variant='outline' onClick={handleRegenerate}>Regenerar Boleto</Button>
com Dialog de confirmação" }, { "step": 4, "action": "Adicionar toast de
feedback para operações de boleto", "file": "app/admin/financeiro/page.tsx",
"codeHint": "import { toast } from 'sonner'; toast.success('Boleto regenerado
com sucesso'); toast.error('Erro ao regenerar boleto');" } ],
"acceptanceCriteria": [ "Clicar múltiplas vezes no botão 'Gerar Boleto' NÃO gera
duplicatas (botão desativado durante processamento)", "Spinner/loading visível
durante geração do boleto", "Toast de sucesso/erro após operação", "Boletos
vencidos mostram opção 'Regenerar' no detalhe financeiro", "Regeneração cancela
boleto antigo e cria novo com nova data de vencimento", "Diálogo de confirmação
antes de regenerar" ] }, { "id": "T3", "title": "Reajuste de Orçamento com
Categorias", "priority": "HIGH", "complexity": "HIGH", "businessContext":
"Quando cliente ultrapassa valor do contrato (obra atrasa, equipamento fica mais
tempo), é necessário gerar aditivo com novo valor. Categorias: Mão de Obra,
Deslocamento, Manutenção, Outros. Gustavo vai enviar tabela de custos
específica.", "existingCode": { "model": "QuoteAdjustment já existe no Prisma
com campos: category, amount, justification, sentEmailAt, sentWhatsappAt",
"enum": "QuoteAdjustmentCategory tem: LABOR, TRAVEL, MAINTENANCE, OTHER",
"apiRoute": "GET/POST /api/admin/quotes/[id]/adjustments JÁ EXISTE",
"quoteRelation": "Quote tem relação adjustments QuoteAdjustment[]" },
"filesToModify": [ "app/api/admin/quotes/[id]/adjustments/route.ts — verificar
se recalcula finalTotal e se gera Payment", "app/admin/orcamentos/page.tsx —
adicionar botão 'Reajuste' e modal completo", "Possivelmente criar componente:
components/admin/quotes/AdjustmentModal.tsx" ], "steps": [ { "step": 1,
"action": "Verificar a rota existente de adjustments e garantir que recalcula
finalTotal", "file": "app/api/admin/quotes/[id]/adjustments/route.ts",
"codeHint": "No POST, após criar QuoteAdjustment: const allAdjustments = await
prisma.quoteAdjustment.findMany({ where: { quoteId } }); const adjustmentTotal =
allAdjustments.reduce((sum, a) => sum.add(new Decimal(a.amount.toString())), new
Decimal(0)); await prisma.quote.update({ where: { id: quoteId }, data: {
finalTotal: new Decimal(quote.originalTotal || quote.total).add(adjustmentTotal)
} })" }, { "step": 2, "action": "Criar UI de modal de reajuste na página de
orçamentos", "file": "app/admin/orcamentos/page.tsx ou
components/admin/quotes/AdjustmentModal.tsx", "codeHint": "Dialog com: Select
(categoria), Input monetário (valor R$), Textarea (justificativa), Checkbox
(gerar boleto), Checkbox (notificar cliente), Button (Aplicar Reajuste)" }, {
"step": 3, "action": "Implementar geração opcional de boleto para o valor do
reajuste", "file": "app/api/admin/quotes/[id]/adjustments/route.ts", "codeHint":
"Se body.generateBoleto === true, criar novo Payment com amount =
adjustment.amount, type = 'LATE_FEE', method = 'BOLETO' e chamar
ensureQuoteBoletoPayment ou criar Payment diretamente" }, { "step": 4, "action":
"Implementar envio de notificação ao cliente", "file":
"app/api/admin/quotes/[id]/adjustments/route.ts", "codeHint": "Se
body.notifyClient === true, enviar e-mail via Resend com detalhes do reajuste
(categoria, valor, justificativa) e atualizar sentEmailAt/sentEmailTo no
QuoteAdjustment" }, { "step": 5, "action": "Adicionar listagem de reajustes no
detalhe do orçamento", "file": "app/admin/orcamentos/page.tsx", "codeHint":
"Section 'Histórico de Reajustes' com tabela: Data | Categoria | Valor |
Justificativa | Criado por | E-mail enviado?" } ], "categoryLabels": { "LABOR":
"Mão de Obra", "TRAVEL": "Deslocamento", "MAINTENANCE": "Manutenção", "OTHER":
"Outros" }, "acceptanceCriteria": [ "Modal de reajuste acessível em orçamentos
com status APPROVED ou em locação ativa", "4 categorias disponíveis no select:
Mão de Obra, Deslocamento, Manutenção, Outros", "Justificativa obrigatória
(mínimo 10 caracteres)", "Valor em R$ com máscara de moeda brasileira",
"Recalcula finalTotal do orçamento (original + soma de todos ajustes)",
"Opcionalmente gera boleto para o valor do reajuste", "Opcionalmente envia
e-mail ao cliente com detalhes", "Histórico de reajustes visível no detalhe do
orçamento" ] }, { "id": "T4", "title": "Dashboard de Aging de Contas a Receber",
"priority": "HIGH", "complexity": "MEDIUM", "businessContext": "O financeiro
precisa visualizar rapidamente quanto está em atraso, por quanto tempo, e quem
são os maiores devedores. Inadimplência é uma dor real — já tiveram calotes com
equipamentos roubados.", "existingCode": { "api": "GET
/api/admin/financial/aging existe (259 linhas) — retorna aging data e top
debtors", "agingChart": "AgingChart.tsx existe (110 linhas) — Recharts BarChart
com status colors", "debtorsTable": "DebtorsTable.tsx existe (119 linhas) —
tabela com clientName, overdueAmount, daysOverdue, status badge", "dashboard":
"page.tsx já tem viewMode === 'dashboard' com os componentes renderizados" },
"filesToModify": [ "components/admin/financial/AgingChart.tsx — melhorar faixas
de cores progressivas", "app/admin/financeiro/page.tsx — adicionar KPI de
inadimplência e destaque no dashboard", "components/admin/admin-sidebar.tsx —
adicionar badgeKey 'financial' ao item Financeiro", "hooks/use-admin-badges.ts —
adicionar contagem de alertas financeiros" ], "steps": [ { "step": 1, "action":
"Melhorar paleta de cores do AgingChart com 5 faixas progressivas", "file":
"components/admin/financial/AgingChart.tsx", "codeHint": "Cores: A vencer
(#16A34A verde), 1-30 dias (#D97706 amarelo), 31-60 dias (#EA580C laranja),
61-90 dias (#DC2626 vermelho), +90 dias (#991B1B vermelho escuro)" }, { "step":
2, "action": "Adicionar KPI de inadimplência ao dashboard", "file":
"app/admin/financeiro/page.tsx", "codeHint": "Na seção dashboard, calcular:
inadimplenciaRate = (totals.unpaid / (totals.unpaid + totals.awaiting +
totals.paid)) * 100. Renderizar com KPICard com cor vermelha se > 20%, amarela
se > 10%, verde caso contrário" }, { "step": 3, "action": "Adicionar badge de
alerta no menu Financeiro da sidebar", "file":
"components/admin/admin-sidebar.tsx", "codeHint": "Adicionar badgeKey:
'financial' ao navItem do Financeiro. No hook useAdminBadges, adicionar fetch
para /api/admin/financial/aging que retorna contagem de entries com atraso > 60
dias" }, { "step": 4, "action": "Reorganizar dashboard para destaque de
AgingChart e DebtorsTable", "file": "app/admin/financeiro/page.tsx", "codeHint":
"No viewMode === 'dashboard': primeira row = KPIs (gross, net, paid,
inadimplência), segunda row = AgingChart (2/3 largura) + DebtorsTable (1/3
largura), terceira row = RevenueChart + RevenueByCategoryChart" } ],
"agingColorScale": { "current": "Verde, Amarelo, Vermelho (3 levels)", "target":
"Verde (#16A34A), Amarelo (#D97706), Laranja (#EA580C), Vermelho (#DC2626),
Vermelho Escuro (#991B1B) — 5 levels" }, "acceptanceCriteria": [ "AgingChart com
5 faixas de cores progressivas (verde → vermelho escuro)", "KPI de taxa de
inadimplência visível no dashboard (com cor condicional)", "Badge numérico no
menu 'Financeiro' da sidebar quando há valores em atraso > 60 dias",
"DebtorsTable mostra top 5-10 devedores com valor total e dias de atraso",
"Layout do dashboard reorganizado: KPIs → Aging+Devedores → Receita" ] }, {
"id": "T5", "title": "Adicionar Tooltips/Legendas Explicativas em Todos os
Status", "priority": "MEDIUM", "complexity": "LOW", "businessContext": "Os
utilizadores não entendem o significado de cada status. Precisam de ícone com
caixa explicativa. Importante para onboarding de novos utilizadores como a
Adriana.", "existingCode": { "hybridTooltip": "HybridTooltip.tsx existe —
funciona em mobile (Popover) e desktop (Tooltip) via Radix", "statusTooltip":
"status-tooltip.tsx existe com interface { status, className, label }",
"infoIcon": "Lucide React tem <Info /> icon disponível" }, "filesToModify": [
"app/admin/financeiro/page.tsx — adicionar tooltips nos badges de status da
tabela e nos filtros", "app/admin/orcamentos/page.tsx — adicionar tooltips nos
status de orçamentos", "Opcionalmente criar constante compartilhada:
lib/status-labels.ts" ], "steps": [ { "step": 1, "action": "Criar ficheiro de
constantes com labels e tooltips de todos os status", "file":
"lib/status-labels.ts", "codeHint": "export const BILLING_STATUS_CONFIG = {
PAID: { label: 'Pago', color: 'green', tooltip: 'Pagamento confirmado e
registrado no sistema' }, UNPAID: { label: 'Não Pago', color: 'red', tooltip:
'Pagamento ainda não realizado. O boleto pode estar vencido.' },
AWAITING_PAYMENT: { label: 'Aguardando Pagamento', color: 'orange', tooltip:
'Boleto emitido, aguardando confirmação bancária' }, SETTLED: { label:
'Baixado', color: 'slate', tooltip: 'Pagamento conciliado manualmente pelo
administrador' } }" }, { "step": 2, "action": "Adicionar HybridTooltip com ícone
Info ao lado de cada badge de status na tabela financeira", "file":
"app/admin/financeiro/page.tsx", "codeHint": "import { HybridTooltip } from
'@/components/ui/HybridTooltip'; import { Info } from 'lucide-react'; ...
<HybridTooltip content={BILLING_STATUS_CONFIG[entry.billingStatus].tooltip}><Info className='h-3.5 w-3.5 text-muted-foreground cursor-help' /></HybridTooltip>"
}, { "step": 3, "action": "Adicionar tooltips nos filtros de status
(dropdown/select)", "file": "app/admin/financeiro/page.tsx", "codeHint": "No
Select de status filter, cada SelectItem deve ter um HybridTooltip com a
descrição do status" }, { "step": 4, "action": "Aplicar tooltips nos status de
orçamentos (Pendente, Aprovado, Rejeitado, Concluído)", "file":
"app/admin/orcamentos/page.tsx", "codeHint": "export const QUOTE_STATUS_CONFIG =
{ PENDING: { label: 'Pendente', tooltip: 'Orçamento recebido, aguardando análise
e aprovação' }, APPROVED: { label: 'Aprovado', tooltip: 'Orçamento aprovado.
Equipamento reservado.' }, REJECTED: { label: 'Rejeitado', tooltip: 'Orçamento
recusado pelo administrador ou cliente' }, COMPLETED: { label: 'Concluído',
tooltip: 'Locação finalizada com sucesso. Equipamento devolvido.' } }" } ],
"statusLabels": { "billing": { "PAID": { "label": "Pago", "color": "green",
"tooltip": "Pagamento confirmado e registrado no sistema" }, "UNPAID": {
"label": "Não Pago", "color": "red", "tooltip": "Pagamento ainda não realizado.
O boleto pode estar vencido." }, "AWAITING_PAYMENT": { "label": "Aguardando
Pagamento", "color": "orange", "tooltip": "Boleto emitido, aguardando
confirmação bancária" }, "SETTLED": { "label": "Baixado", "color": "slate",
"tooltip": "Pagamento conciliado manualmente pelo administrador" } }, "quote": {
"PENDING": { "label": "Pendente", "color": "yellow", "tooltip": "Orçamento
recebido, aguardando análise e aprovação" }, "APPROVED": { "label": "Aprovado",
"color": "green", "tooltip": "Orçamento aprovado. Equipamento reservado para o
cliente." }, "REJECTED": { "label": "Rejeitado", "color": "red", "tooltip":
"Orçamento recusado pelo administrador ou pelo cliente" }, "COMPLETED": {
"label": "Concluído", "color": "blue", "tooltip": "Locação finalizada com
sucesso. Equipamento devolvido." } }, "rental": { "PENDING": { "label":
"Pendente", "tooltip": "Locação criada, aguardando início" }, "ACTIVE": {
"label": "Ativo", "tooltip": "Equipamento em uso pelo cliente" }, "COMPLETED": {
"label": "Concluído", "tooltip": "Equipamento devolvido, locação encerrada" },
"CANCELLED": { "label": "Cancelado", "tooltip": "Locação cancelada antes da
conclusão" }, "OVERDUE": { "label": "Atrasado", "tooltip": "Data de devolução
ultrapassada. Contactar cliente." } } }, "acceptanceCriteria": [ "Ícone Info ao
lado de cada badge de status na tabela financeira", "Tooltip aparece ao hover
(desktop) e tap (mobile) via HybridTooltip", "Texto descritivo em português
brasileiro para cada status", "Tooltips aplicados na tabela financeira, filtros
de status e página de orçamentos", "Constantes centralizadas num ficheiro
reutilizável (lib/status-labels.ts)" ] }, { "id": "T6", "title": "Corrigir Campo
de Pesquisa para Usar ID do Orçamento", "priority": "MEDIUM", "complexity":
"LOW", "businessContext": "Francisco reportou que o campo de pesquisa de
orçamentos usa o ID do equipamento em vez do código do orçamento. Investigação
revelou que a API JÁ pesquisa em quoteCode, mas pode haver orçamentos sem
quoteCode preenchido.", "existingCode": { "apiSearch": "API /api/admin/quotes já
pesquisa em: id, quoteCode, legacyExternalCode, name, email, phone, company
(mode: insensitive)", "placeholder": "O placeholder da pesquisa já diz: 'Buscar
por cliente, código do orçamento, e-mail...'", "debounce": "Pesquisa usa
debounce de 350ms" }, "filesToModify": [ "app/admin/orcamentos/page.tsx —
verificar que quoteCode é mostrado de forma proeminente na tabela/kanban",
"Possivelmente: scripts/backfill-quote-codes.ts — gerar quoteCode para
orçamentos antigos sem código", "app/api/admin/quotes/route.ts — verificar se
search inclui quoteCode (JÁ INCLUI)" ], "steps": [ { "step": 1, "action":
"Verificar se todos os orçamentos têm quoteCode preenchido", "file": "scripts/
ou via Prisma Studio", "codeHint": "SELECT COUNT(*) FROM quotes WHERE
\"quoteCode\" IS NULL; — Se houver, criar script: const quotes = await
prisma.quote.findMany({ where: { quoteCode: null } }); for (const q of quotes) {
await prisma.quote.update({ where: { id: q.id }, data: { quoteCode:
`ORC-${q.createdAt.getFullYear()}-${String(idx).padStart(3, '0')}` } }) }" }, {
"step": 2, "action": "Garantir que quoteCode é a primeira coluna visível na
tabela de orçamentos (não o cuid interno)", "file":
"app/admin/orcamentos/page.tsx", "codeHint": "Na renderização da tabela/lista,
trocar a exibição do id pelo quoteCode como identificador principal visível ao
utilizador" }, { "step": 3, "action": "Atualizar placeholder do campo de
pesquisa se necessário", "file": "app/admin/orcamentos/page.tsx", "codeHint":
"searchPlaceholder='Pesquisar por código do orçamento (ex: ORC-2026-001) ou nome
do cliente...'" } ], "acceptanceCriteria": [ "Pesquisa por quoteCode (ex:
ORC-2026-001) encontra o orçamento correto", "Pesquisa por nome do cliente
funciona", "quoteCode é o identificador principal visível na listagem (não o
cuid)", "Todos os orçamentos têm quoteCode preenchido (incluindo antigos via
backfill)", "Placeholder claro sobre o que pode ser pesquisado" ] }, { "id":
"T7", "title": "Melhorar Exportação Excel com Identidade Visual e Novas Abas",
"priority": "MEDIUM", "complexity": "HIGH", "businessContext": "O relatório
Excel atual é funcional mas básico — uma única aba com cabeçalho azul. O cliente
precisa de um relatório profissional multi-abas que possa ser apresentado a
stakeholders e usado para auditorias.", "existingCode": { "exportRoute":
"app/api/admin/financial/export/route.ts (778 linhas) — já gera XLSX com
ExcelJS", "currentXlsx": "Uma aba 'Relatório Financeiro' com: título, subtítulo,
resumo, tabela com headers azuis (#1A56DB), linhas alternadas (#F8F9FA),
auto-filter, formatação de moeda", "exceljs": "ExcelJS 4.4.0 já instalado",
"agingApi": "API de aging já retorna dados de faixas e devedores" },
"filesToModify": [ "app/api/admin/financial/export/route.ts — expandir função
buildXlsx com novas abas" ], "steps": [ { "step": 1, "action": "Reestruturar
buildXlsx para criar múltiplas worksheets", "file":
"app/api/admin/financial/export/route.ts", "codeHint": "const wsResumo =
workbook.addWorksheet('Resumo Executivo', { properties: { tabColor: { argb:
'FFF97316' } } }); const wsLancamentos = workbook.addWorksheet('Lançamentos
Detalhados'); const wsAging = workbook.addWorksheet('Contas a Receber'); const
wsTributario = workbook.addWorksheet('Análise Tributária');" }, { "step": 2,
"action": "Implementar aba Resumo Executivo com KPIs e composição por status",
"file": "app/api/admin/financial/export/route.ts", "codeHint": "Células
mescladas com fundo laranja (#F97316) para cabeçalho. KPIs em cards: Total
Bruto, Líquido, Pago, Pendente, Nº Lançamentos. Composição: Pagos X (Y%), Não
Pagos X (Y%), Aguardando X (Y%), Baixados X (Y%)" }, { "step": 3, "action":
"Implementar aba Lançamentos com formatação condicional por status", "file":
"app/api/admin/financial/export/route.ts", "codeHint": "Usar
addConditionalFormatting ou aplicar fill manualmente por row: PAID → #DCFCE7,
UNPAID → #FEE2E2, AWAITING → #FEF3C7, SETTLED → #F1F5F9. Cabeçalhos com fundo
laranja (#F97316) em vez de azul." }, { "step": 4, "action": "Implementar aba
Contas a Receber (Aging)", "file": "app/api/admin/financial/export/route.ts",
"codeHint": "Buscar dados de aging via query direta (mesma lógica do
aging/route.ts). Tabela de faixas: A vencer, 1-30, 31-60, 61-90, +90 com
quantidade, valor, percentual. Tabela de top 10 devedores abaixo." }, { "step":
5, "action": "Implementar aba Análise Tributária", "file":
"app/api/admin/financial/export/route.ts", "codeHint": "Agrupar dados por
taxDocumentType (CPF vs CNPJ vs CNI): count, grossTotal, netTotal, avgRate,
totalTaxRetained. Agrupar por taxRegimeSnapshot: SIMPLES_NACIONAL,
LUCRO_PRESUMIDO, LUCRO_REAL." }, { "step": 6, "action": "Aplicar identidade
visual global", "file": "app/api/admin/financial/export/route.ts", "codeHint":
"Todas as abas: cabeçalho 'GB Locações' com fundo #F97316, texto branco. Rodapé:
'Gerado em DD/MM/YYYY — GB Locações © 2026'. Colunas auto-dimensionadas. Print
setup: landscape, fitToWidth." } ], "brandColors": { "primary": "#F97316",
"primaryDark": "#EA580C", "primaryLight": "#FFF7ED", "secondary": "#1F2937",
"accent": "#1A56DB", "statusGreen": "#DCFCE7", "statusRed": "#FEE2E2",
"statusYellow": "#FEF3C7", "statusGray": "#F1F5F9", "altRow": "#F8FAFC" },
"excelSheets": [ { "name": "Resumo Executivo", "tabColor": "#F97316", "content":
"KPIs em cards, composição por status com percentuais, cabeçalho da empresa" },
{ "name": "Lançamentos Detalhados", "tabColor": "#1A56DB", "content": "Tabela
completa com formatação condicional, colunas adicionais de tributação" }, {
"name": "Contas a Receber", "tabColor": "#DC2626", "content": "Aging por faixas
(5 níveis), top 10 devedores" }, { "name": "Análise Tributária", "tabColor":
"#16A34A", "content": "Resumo por tipo de documento (CPF/CNPJ/CNI), por regime
tributário" } ], "acceptanceCriteria": [ "Excel gerado com 4 abas: Resumo
Executivo, Lançamentos, Contas a Receber, Análise Tributária", "Identidade
visual com cores da marca (laranja #F97316 como cor primária)", "Formatação
condicional por status de faturamento (cores diferentes por status)", "KPIs na
aba Resumo com composição percentual", "Aging com 5 faixas de atraso e lista de
devedores", "Análise por tipo de documento e regime tributário", "Cabeçalho 'GB
Locações' e rodapé com data de geração em todas as abas", "Configuração de
impressão: paisagem, ajustar à largura, linhas alternadas", "Auto-filter em
todas as tabelas" ] } ], "statusLabels": { "PAID": { "label": "Pago", "color":
"green", "tooltip": "Pagamento confirmado e registrado no sistema" }, "UNPAID":
{ "label": "Não Pago", "color": "red", "tooltip": "Pagamento ainda não
realizado. O boleto pode estar vencido." }, "AWAITING_PAYMENT": { "label":
"Aguardando Pagamento", "color": "orange", "tooltip": "Boleto emitido,
aguardando confirmação bancária" }, "SETTLED": { "label": "Baixado", "color":
"slate", "tooltip": "Pagamento conciliado manualmente pelo administrador" } },
"brandIdentity": { "primaryColor": "#F97316", "primaryDark": "#EA580C",
"primaryLight": "#FFF7ED", "secondaryColor": "#1F2937", "accentColor":
"#1A56DB", "backgroundColor": "#FFFFFF", "lightGray": "#F8FAFC", "mediumGray":
"#E2E8F0", "textDark": "#1E293B", "textMedium": "#64748B", "companyName": "GB
Locações", "website": "locacoesgb.com.br", "tagline": "Equipamentos para
Construção" }, "implementationOrder": [ { "order": 1, "taskId": "T1", "reason":
"RBAC é base de segurança — prioridade absoluta" }, { "order": 2, "taskId":
"T5", "reason": "Rápido de implementar, melhora UX imediatamente" }, { "order":
3, "taskId": "T6", "reason": "Rápido de implementar, resolve confusão do
utilizador" }, { "order": 4, "taskId": "T2", "reason": "Bug real de produção que
pode gerar cobranças duplicadas" }, { "order": 5, "taskId": "T3", "reason":
"Funcionalidade nova com backend parcialmente existente" }, { "order": 6,
"taskId": "T4", "reason": "Melhoria de visualização sobre componentes
existentes" }, { "order": 7, "taskId": "T7", "reason": "Mais complexa, pode ser
feita por último sem impacto operacional" } ] } </CONTEXTO_EM_JSON>
