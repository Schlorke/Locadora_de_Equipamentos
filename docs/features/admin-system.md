# 🏗️ Sistema Administrativo Completo - GB Locações

> **Caminhos atuais (conferidos em 2026-09-30)**: as pastas `components/` e
> `hooks/` da raiz não existem mais. `AdminPageHeader` está em
> `packages/frontend/src/widgets/cabecalho-admin`, `AdminFilterCard` em
> `packages/frontend/src/widgets/filtro-admin`, `AdminDesktopHeader` em
> `packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraDesktop.web.tsx`;
> `Button`, `Card`, `Input` e `Label` vêm de `@gb-locacoes/ui`
> (`packages/ui/src/web`); o toast é o `toast` (sonner) de
> `packages/frontend/src/shared/lib`. Os caminhos antigos abaixo são históricos.

Ponteiros atuais dos modelos (onda 135, 2026-10-09):
`packages/frontend/src/pages/dashboard/model/contratos.ts` mantém DTOs e
iniciais universais; `model/tipos.web.ts` concentra os ícones e configurações
web dos cards/atalhos. Em `pages/locacoes/model/contratos.ts` ficam os contratos
compartilhados e em `tipos.web.ts`, a configuração visual de status;
`ui/formatar.web.tsx` renderiza os badges web. As variantes Expo permanecem
sobre os contratos/modelos comuns.

> **Documentação completa do painel administrativo: design system, componentes,
> guias e implementação**

Onda 120 (2026-10-04, local): a composição visual é
`packages/frontend/src/app/providers/AdminLayoutShell.web.tsx`. Os layouts do
host web e do legado reutilizam menus/cabeçalhos e estados dessa moldura. O
guard legado mantém sua autorização; no web, RuntimeBootstrap/PrivateAreaGate
mantêm sessão e seleção. O seletor existente é entregue ao main depois da
abertura do gate, abaixo dos cabeçalhos fixos. Sem seleção continua disponível e
nenhuma tela privada é aberta. Não é uma segunda implementação de identidade.
Provas e limites na onda 120 de `shared-api-host.md` e entrada 295.

Continuidade da onda 135 (2026-10-08): o texto de ajuda do e-mail comercial em
`ConfiguracoesPage.web.tsx` tinha um utilitário híbrido inválido. A restauração
separa as classes existentes de entrelinha e cor; não cria tokens, estilos ou
layout. A referência é fonte de 12px, entrelinha de 19,2px e cor secundária
`rgb(107,114,128)` nos viewports 390/1440. A captura com o web compilado em
produção confirmou os três valores nos dois tamanhos, sem espera instável;
entrada 329. Baselines antigos do painel permanecem preservados para revisão da
moldura administrativa e de estados, sem aprovação em bloco.

A simulação visual do ADMIN sem propriedade agora responde 403 `OWNER_REQUIRED`
em `/api/onboarding/status`, conforme o contrato do dono; o widget oculta esse
estado. A caixa de notificações desse ADMIN é vazia, coerente com seus
contadores, sem reutilizar as notificações da persona CLIENT. A recaptura depois
desses ajustes ainda precisa ser conferida.

As leituras de unidades físicas (`GET /api/admin/equipment-units` e `/[id]`)
também estão instaladas localmente no serviço compartilhado, com
EQUIPMENTS/READ, isolamento por locadora e os contratos catalog existentes.
`GerenciadorUnidades` mantém sua URL e o array sem envelope; medidores Decimal
continuam textuais no JSON. POST também está no serviço (corte 30), com
EQUIPMENTS/WRITE, schema comum em contracts/equipment-units e createUnit do
catálogo. Preserva 201, código único por locadora, AVAILABLE, medidores zero
gravados como nulos e ausência de alteração de estoque. JSON malformado mantém
500; validação Zod e código repetido mantêm 400; equipamento alheio/ausente
mantém 404. PATCH/DELETE por id também estão no serviço (corte 31), com
WRITE/DELETE distintos e posse antes do corpo. PATCH vazio preserva updatedAt;
zero fica textual no JSON e textos vazios viram nulos; RENTED/RESERVED impedem
DELETE. Stock e disponibilidade do equipamento não mudam. A origem configurada
dos clientes permanece legada. Estado e provas:
[API compartilhada](shared-api-host.md), cortes 15/30/31. O detalhe
administrativo de equipamento (`GET /api/admin/equipments/[id]`) também está
instalado no serviço, com o DTO completo e a política catalog existentes (corte
16). A lista administrativa (`GET /api/admin/equipments`) foi instalada no corte
17, com paginação, filtros, DTO e limitador em memória compartilhado por
implementação, sem compartilhar contadores entre processos. POST de equipamentos
também está composto (corte 32), com EQUIPMENTS/WRITE e CSRF central. GET/POST
consomem a mesma janela de 200 requisições por minuto antes da autorização.
createEquipment continua no catálogo: valida a categoria da locadora, normaliza
nome/descrição, aplica parseFloat ao preço e preserva opções de locação e DTO
completo com categoria. Preço é numérico; valores diretos são textuais;
isAvailable espelha available. Imagens vazias são descartadas, mas whitespace de
strings válidas é preservado. Frações em maxStock/descontos Int mantêm a coerção
observada no legado (1.5 vira 1); criação não gera unidades e aceita nomes
repetidos. JSON malformado mantém 500 e erro com code mantém 400; detalhes só em
development. PUT/DELETE de equipamentos também estão no serviço (onda 33),
delegando a updateEquipment/deleteEquipment. Na edição, espaços de nome e
descrição são preservados e maxStock zero não substitui o estoque; a exclusão
mantém as relações protegidas pelo banco. Falhas inesperadas do PUT são
genéricas fora de development (entrada 234). GET /api/admin/permissions também
está instalado (corte 18); exige ADMIN do vínculo e compartilha a consulta em
identidade. POST /api/admin/drivers foi instalado no corte 27, com ADMIN do
vínculo. O corte 28 instala POST /api/admin/categories, com EQUIPMENTS/WRITE e o
schema estrito comum em contracts/categories. Normalização, unicidade por
locadora, transação e lock continuam no catálogo compartilhado. Mantém 201 com
DTO sem envelope, 400 para JSON malformado/validação e 409 para categoria já
existente; recusas de principal/CSRF precedem o parsing. O corte 29 instala
PUT/DELETE por id: exige EQUIPMENTS/WRITE ou DELETE respectivamente; categoria
alheia/ausente dá 404 antes de ler o corpo, e vínculo com equipamento impede a
exclusão no banco. Preserva DTO, sucesso de exclusão e erros genéricos; regras e
transação continuam no catálogo. Demais escritas administrativas e a origem
configurada dos clientes continuam legadas. Provas nos cortes 28/29 de
[API compartilhada](shared-api-host.md).

## Host compartilhado — ciclo de locação (onda 35, 2026-10-02)

GET/POST /api/admin/rentals, GET/PATCH/DELETE do detalhe e POST de checkout,
checkin, extend e calculate-late-fee também estão montados em apps/services/api.
ADMIN é o papel do vínculo atual, com sessão e CSRF centrais. As factories
existentes de backend/rentals mantêm regras, lock, disponibilidade, documentos,
centavos, conversão e outbox. Schemas comuns em contracts/rentals.

Criação com orçamento reaproveita a locação existente; cancelamento não apaga
linha nem itens. Checkout exige quitação e quatro documentos, com retry
idempotente. Checkin completa e registra dano arredondado. Prorrogação com
boleto enfileira emissão e conserva 202; sem boleto conserva 200, sem cobrança.
Falha em cobrança/outbox desfaz datas e itens. Consumidores e emissão externa
continuam legados. Evidências consolidadas e limites:
[API compartilhada](shared-api-host.md), onda 35.

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [🚀 Quick Start Guide](#-quick-start-guide)
- [📋 AdminPageHeader - Padrão e Erros](#-adminpageheader---padrão-e-erros)
- [🎨 Design System](#-design-system)
- [🧩 Componentes Reutilizáveis](#-componentes-reutilizáveis)
- [👤 Header Administrativo e Menu do Usuário](#-header-administrativo-e-menu-do-usuário)
- [⚙️ Configurações e Settings](#️-configurações-e-settings)
- [📊 Dashboard e Analytics](#-dashboard-e-analytics)
- [🔐 Autenticação e Permissões](#-autenticação-e-permissões)

---

## 🎯 Visão Geral

O sistema administrativo do GB-Locações é uma interface moderna e intuitiva
construída com:

- **Next.js 16** com App Router
- **React 19** com Server Components
- **TypeScript** para type safety
- **Tailwind CSS** para estilização
- **Framer Motion** para animações
- **Radix UI** para componentes acessíveis

### 🎯 **Características Principais**

- **📱 Responsivo** - Funciona perfeitamente em desktop, tablet e mobile
- **⚡ Performance** - Otimizado para velocidade e experiência fluida
- **♿ Acessível** - Compatível com leitores de tela e navegação por teclado
- **🎨 Consistente** - Design system unificado e componentizado
- **🔐 Seguro** - Autenticação robusta e controle de permissões

---

## 🚀 Quick Start Guide

### **Template Base para Nova Página**

> ⚠️ **IMPORTANTE**: Sempre use o componente `AdminPageHeader` em vez de criar
> headers customizados. Consulte
> [`admin-page-header-pattern.md`](./admin-page-header-pattern.md) para detalhes
> completos.

```tsx
"use client"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminFilterCard } from "@/components/admin/admin-filter-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { Package } from "lucide-react"
import { useState, useEffect } from "react"

export default function NovaPagina() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        {/* HEADER OBRIGATÓRIO - Use AdminPageHeader */}
        <AdminPageHeader
          title="Título da Página"
          subtitle="Subtítulo explicativo"
          icon={<Package className="w-8 h-8" />}
          infoBadge={{
            icon: <Package className="w-5 h-5 text-orange-50" />,
            text: `${filteredItems.length} itens encontrados`
          }}
          className="mb-8"
        />

        {/* CONTEÚDO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
            <div className="absolute inset-0 bg-linear-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/20 to-gray-50/40"></div>

            <CardHeader className="relative z-10">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Título do Card
              </CardTitle>
            </CardHeader>

            <CardContent className="relative z-10 space-y-8">
              {/* Seu conteúdo aqui */}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
```

### **Elementos Essenciais**

#### **1. Seção de Formulário**

```tsx
<div className="space-y-6">
  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
    <Package className="w-5 h-5 text-orange-600" />
    <h3 className="text-lg font-semibold text-gray-900">Informações Básicas</h3>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-2">
      <Label htmlFor="nome">Nome</Label>
      <Input id="nome" placeholder="Digite o nome..." />
    </div>
    <div className="space-y-2">
      <Label htmlFor="categoria">Categoria</Label>
      <Input id="categoria" placeholder="Selecione a categoria..." />
    </div>
  </div>
</div>
```

#### **2. Botões de Ação**

```tsx
<div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
  <Button
    type="submit"
    disabled={loading}
    className="bg-orange-600 hover:bg-orange-700"
  >
    {loading ? "Salvando..." : "Salvar"}
    <Save className="w-4 h-4 ml-2" />
  </Button>
  <Button variant="outline" type="button">
    Cancelar
  </Button>
</div>
```

---

## 🎨 Design System

### **🎨 Paleta de Cores**

#### **Cores Primárias**

- **Orange 600** (`#ea580c`) - Cor principal da marca
- **Orange 500** (`#f97316`) - Hover states
- **Orange 700** (`#c2410c`) - Active states

#### **Cores Neutras**

- **Slate 50** (`#f8fafc`) - Background claro
- **Slate 100** (`#f1f5f9`) - Background cards
- **Slate 800** (`#1e293b`) - Texto principal
- **Slate 600** (`#475569`) - Texto secundário

#### **Cores de Status**

- **Green 600** (`#16a34a`) - Sucesso
- **Red 600** (`#dc2626`) - Erro/Perigo
- **Yellow 600** (`#ca8a04`) - Aviso
- **Blue 600** (`#2563eb`) - Informação

### **📝 Tipografia**

#### **Hierarquia de Títulos**

```css
/* H1 - Títulos principais de página */
.admin-h1 {
  @apply text-3xl font-bold text-white drop-shadow-sm;
}

/* H2 - Títulos de seção */
.admin-h2 {
  @apply text-xl font-semibold text-gray-900;
}

/* H3 - Subtítulos */
.admin-h3 {
  @apply text-lg font-semibold text-gray-900;
}

/* Body - Texto padrão */
.admin-body {
  @apply text-base text-gray-700;
}

/* Small - Texto auxiliar */
.admin-small {
  @apply text-sm text-gray-600;
}
```

### **🎭 Animações**

#### **Animações de Entrada**

```tsx
// Fade in com slide up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>

// Stagger para listas
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
}
```

### **📐 Layout e Spacing**

#### **Container Principal**

```tsx
<div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50">
  <div className="max-w-7xl mx-auto space-y-6 p-6">{/* Conteúdo */}</div>
</div>
```

#### **Grid System**

```tsx
// Grid responsivo
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Grid com auto-fit
<div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
```

---

## 🧩 Componentes Reutilizáveis

### **1. AdminPageHeader**

```tsx
interface AdminPageHeaderProps {
  title: string
  subtitle: string
  backHref?: string
  icon: React.ReactNode
  badge?: {
    icon: React.ReactNode
    text: string
  }
}

export function AdminPageHeader({
  title,
  subtitle,
  backHref,
  icon,
  badge
}: AdminPageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="relative overflow-hidden bg-linear-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-linear-to-br from-orange-400/12 via-transparent to-black/15"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            {backHref && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={backHref}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <div className="flex items-center gap-3">
              {icon}
              <div>
                <h1 className="text-3xl font-bold text-white drop-shadow-sm">
                  {title}
                </h1>
                <p className="text-orange-50 font-medium">{subtitle}</p>
              </div>
            </div>
          </div>
          {badge && (
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit">
              {badge.icon}
              <span className="font-semibold text-white">{badge.text}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
```

### **2. AdminCard**

```tsx
interface AdminCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function AdminCard({ title, children, className }: AdminCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm",
        className
      )}
    >
      <div className="absolute inset-0 bg-linear-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
      <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/20 to-gray-50/40"></div>

      <CardHeader className="relative z-10">
        <CardTitle className="text-xl font-semibold text-gray-900">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="relative z-10">{children}</CardContent>
    </Card>
  )
}
```

### **3. AdminFilterCard**

```tsx
interface AdminFilterCardProps {
  onSearch: (term: string) => void
  onCategoryFilter: (category: string) => void
  onStatusFilter: (status: string) => void
  searchPlaceholder?: string
}

export function AdminFilterCard({
  onSearch,
  onCategoryFilter,
  onStatusFilter,
  searchPlaceholder = "Buscar..."
}: AdminFilterCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select onValueChange={onCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="equipments">Equipamentos</SelectItem>
                <SelectItem value="tools">Ferramentas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select onValueChange={onStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### **Layout (coluna única em resoluções intermediárias)**

Algumas telas (ex.: `packages/frontend/src/pages/orcamentos-admin`) podem ficar
“apertadas” em tablet/`md`. Para isso, o `AdminFilterCard` suporta um modo que
**força coluna única** para todos os elementos do card:

```tsx
<AdminFilterCard layout="stacked" />
```

---

## 🗂️ Gerenciamento de Categorias

### **Página Admin de Categorias**

O código atual oferece busca, grade paginada, visualização, criação/edição e
exclusão com o diálogo unificado. Web e Expo consomem a slice de categorias; a
API fica em `apps/services/api/src/app/api/admin/categories` sobre
backend/catalog. A montagem na antiga raiz era o checkpoint histórico; a nota de
manutenção não representa o comportamento atual.

### **Paginação Inteligente**

- 📦 Itens por página: `9` (constante `ITEMS_PER_PAGE`)
- 🔁 Estado controlado com `currentPage` e `SmartPagination`
- ♿ Controles anteriores/próximos com rótulos acessíveis PT-BR
- ⚡ Paginador oculta automaticamente quando existe apenas uma página

```tsx
const ITEMS_PER_PAGE = 9
const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE)
const effectiveCurrentPage =
  totalPages > 0 ? Math.min(currentPage, totalPages) : 1
const paginatedCategories = filteredCategories.slice(
  (effectiveCurrentPage - 1) * ITEMS_PER_PAGE,
  effectiveCurrentPage * ITEMS_PER_PAGE
)

return (
  <>
    {/* Grade de categorias */}
    <SmartPagination
      currentPage={effectiveCurrentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  </>
)
```

> ℹ️ O componente `SmartPagination` está disponível em
> `packages/ui/src/web/SmartPagination.web.tsx` e utiliza internamente o sistema
> de paginação padronizado (`packages/ui/src/web/Pagination.web.tsx`),
> garantindo estilos consistentes com hover, foco e labels em português.

---

## 👤 Header Administrativo e Menu do Usuário

### **Componente AdminDesktopHeader**

O header administrativo
(`packages/frontend/src/widgets/cabecalho-admin-barra/ui/BarraDesktop.web.tsx`)
é a barra superior fixa presente em todas as páginas da área administrativa,
exibida apenas em dispositivos desktop (breakpoint `md:` e acima).

#### **Funcionalidades Principais**

1. **Saudação Dinâmica**
   - Exibe uma saudação contextual baseada no horário:
     - "Bom dia" (00:00 - 11:59)
     - "Boa tarde" (12:00 - 17:59)
     - "Boa noite" (18:00 - 23:59)
   - Mostra o nome do usuário logado

2. **Notificações**
   - Ícone de sino com badge de notificações não lidas
   - Dropdown que abre no hover exibindo até 6 notificações recentes
   - No cabeçalho do dropdown: à esquerda do título "Notificações", um Badge
     (`variant="secondary"`) com a quantidade de não lidas; à direita, botão
     "Selecionar" (quando houver notificações). No modo seleção aparecem "Marcar
     todas", "Limpar" e "Cancelar"
   - Cada notificação mostra:
     - Título e mensagem
     - Tempo relativo (ex: "2h atrás")
     - Indicador visual para não lidas
   - Clique em uma notificação redireciona para a URL de ação

3. **Menu do Usuário (Avatar)**
   - Avatar do usuário com iniciais ou foto
   - Dropdown que abre no hover com as opções:
     - **Meu Perfil**: Redireciona para `/admin/perfil`
     - **Configurações**: Redireciona para `/admin/settings`
     - **Sair**: Realiza logout e redireciona para `/admin/login`
   - Mostra nome completo e email do usuário no topo do menu
   - Estados visuais:
     - Hover no avatar: borda mais clara
     - Hover nos itens do menu: fundo laranja claro
     - Item "Sair" com cor vermelha para indicar ação destrutiva

#### **Implementação e Padrões**

**Dropdown com Hover:**

```tsx
// Padrão usado para abrir dropdown no hover
const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

<DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
  <DropdownMenuTrigger asChild>
    <button
      onMouseEnter={() => setIsUserMenuOpen(true)}
      aria-label={userName}
    >
      {/* Conteúdo do trigger */}
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent
    onMouseLeave={() => setIsUserMenuOpen(false)}
  >
    {/* Itens do menu */}
  </DropdownMenuContent>
</DropdownMenu>
```

**Logout Seguro:**

```tsx
import { signOut } from "next-auth/react"

const handleLogout = async () => {
  await signOut({ callbackUrl: "/admin/login" })
}
```

#### **Estilos e Design**

O header segue os padrões do design system administrativo:

- **Background**: Gradiente escuro com blur (`from-slate-700 to-slate-800`)
- **Dropdown Menu**:
  - Largura: `w-56` (224px)
  - Background: Branco com sombra elevada
  - Bordas arredondadas: `rounded-xl`
  - Padding interno: `p-2`
- **Itens do Menu**:
  - Hover padrão: `hover:bg-orange-50 hover:text-orange-600`
  - Item "Sair": `text-red-600 hover:bg-red-50 hover:text-red-700`
- **Avatar**:
  - Tamanho: `h-10 w-10`
  - Borda: `border-2 border-white/20`
  - Hover: `hover:border-white/40`

#### **Acessibilidade**

- ✅ Labels ARIA em todos os botões (`aria-label`)
- ✅ Navegação por teclado funcional
- ✅ Foco visível com `focus-visible:ring-2`
- ✅ Estados hover/focus bem definidos
- ✅ Cores de contraste adequadas (WCAG 2.1 AA)

#### **Responsividade**

- **Desktop**: Visível e fixo no topo (`hidden md:block`)
- **Mobile/Tablet**: O header desktop fica oculto; o header mobile exibe o mesmo
  bloco de notificações + avatar (via componente compartilhado
  `AdminHeaderActions`), entre o título da página e o botão do menu hambúrguer.
- **Sincronização com Sidebar**: Ajusta largura automaticamente quando sidebar
  colapsa/expande
- **Safari iOS (topo/rodape do navegador)**: a sincronização atual vive em
  `packages/frontend/src/app/providers/ClientLayoutShell.web.tsx`: pathname
  /admin define theme-color #334155, status-bar-style default e o fundo do html.
  O layout web `apps/clients/web/src/app/layout.tsx` tem viewport global; o
  grupo (admin) só compõe AppHostProviders/AdminLayoutShell. O antigo viewport
  de app/admin/layout e o reforço de app/ClientLayout são história da raiz
  aposentada, não arquivos a restaurar. Isso descreve código; não é nova prova
  de Safari iOS.

#### **Exemplo de Uso**

```tsx
// Trecho dentro de packages/frontend/src/app/providers/AdminLayoutShell.web.tsx
import { AdminDesktopHeader } from "../../widgets/cabecalho-admin-barra"

export default function AdminLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <>
      <AdminDesktopHeader isSidebarCollapsed={isSidebarCollapsed} />
      {/* Restante do layout */}
    </>
  )
}
```

#### **⚠️ Observações Importantes**

1. **Hover vs Click**: Os dropdowns abrem no hover para melhor UX, mas também
   funcionam com click
2. **Avatar Fallback**: Sempre exibe iniciais do nome quando não há foto
3. **Sincronização**: O estado dos dropdowns é gerenciado independentemente para
   evitar conflitos
4. **Performance**: Usa `useState` local para estados de UI, evitando re-renders
   desnecessários

---

## ⚙️ Configurações e Settings

### API por locadora (onda 44, 2026-10-02, sem commit)

GET/PUT `/api/admin/settings` têm adapters nos hosts legado e compartilhado, com
SETTINGS/READ ou WRITE do vínculo validado, CSRF e `no-store`. A regra única é
`createAdminSettings` em backend/catalog; o schema antes duplicado no frontend e
no legado é idêntico e agora mora em contracts/settings. Fachadas preservam os
importadores anteriores, sem mudança na UI ou na origem HTTP dos clientes.

GET não cria registro; sem settings, devolve padrões com o nome da locadora. PUT
valida, recusa credenciais SMTP/captcha em claro, trava a organização e grava
sob a locadora do principal. Campos públicos SMTP/security podem ser editados
sem apagar os segredos armazenados, que não entram na resposta. O índice
settings_tenantId_key impede duas linhas por locadora; a defesa adicional contra
duplicatas continua caracterizada na suíte unitária.

POST `/api/upload` continua exclusivo de ADMIN, mesmo quando outro papel tem
permissão granular de settings. O objeto publicado é uma imagem; a operação não
é anônima. Validação/transformação em backend/catalog, quota e resposta em
backend/http, cliente Supabase lazy em backend/runtime. Caminhos equipamentos/
logos são próprios da locadora. Tamanho, sanitização SVG, conversão JPEG/PNG
para WebP, cache de um ano e resposta existente foram preservados. A quota é de
30 requisições de imagem por usuário/locadora em dez minutos, sob lock
compartilhado no banco; erro de bytes ou storage depois do registro também
consome a quota.

Após commit do PUT, a composição continua chamando revalidatePath para
`/admin/settings` e `/`. Essas chamadas afetam o cache do host que recebeu a
requisição. A migração operacional ainda deve prover invalidação do web ao
receber uma escrita no serviço separado. Se a chamada de cache lança erro depois
do commit, o envelope continua informando falha apesar de a gravação ter
ocorrido; esse comportamento anterior foi caracterizado e preservado nesta
extração.

Provas e limites na onda 44 de [API compartilhada](shared-api-host.md).

### **Sistema de Settings**

O admin possui um sistema robusto de configurações baseado em:

- **Zustand** para gerenciamento de estado global
- **React Hook Form** para formulários
- **Zod** para validação
- **LocalStorage** para persistência

#### **Hook de Settings**

```tsx
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AdminSettings {
  theme: "light" | "dark" | "system"
  sidebarCollapsed: boolean
  notificationsEnabled: boolean
  autoSave: boolean
  language: "pt" | "en"

  // Actions
  setTheme: (theme: "light" | "dark" | "system") => void
  toggleSidebar: () => void
  toggleNotifications: () => void
  toggleAutoSave: () => void
  setLanguage: (language: "pt" | "en") => void
}

export const useAdminSettings = create<AdminSettings>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarCollapsed: false,
      notificationsEnabled: true,
      autoSave: true,
      language: "pt",

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      toggleAutoSave: () => set((state) => ({ autoSave: !state.autoSave })),
      setLanguage: (language) => set({ language })
    }),
    {
      name: "admin-settings"
    }
  )
)
```

### **Página de Settings**

A página de configurações é dividida em seções:

1. **Preferências Gerais**
2. **Notificações**
3. **Aparência**
4. **Segurança**
5. **Integrações**

---

## 📊 Dashboard e Analytics

### API compartilhada do dashboard (onda 53, 2026-10-02, sem commit)

`GET /api/admin/dashboard` e `GET /api/admin/kpis` permanecem ativos na raiz e
também estão montados em `apps/services/api`. Ambos exigem sessão, vínculo
ativo, seleção explícita e `FINANCIAL/READ`; ADMIN é autorizado pela membership,
CLIENT é recusado mesmo com Permission. A consulta e os cálculos têm
implementação única em `packages/backend/src/modules/billing`, com adaptação
HTTP compartilhada.

Fórmulas, filtros e DTOs anteriores foram preservados, inclusive diferenças
entre `status` e `billingStatus`, datas locais, receitas de boleto, tipos
Decimal/string, arrays completos no KPI e limite de dez entradas de ROI no
dashboard sem ordenação nova. Datas inválidas do KPI continuam produzindo o 500
genérico do Prisma; parâmetros de data do dashboard continuam ignorados. O
escopo financeiro existente é reutilizado, sem filtro paralelo nem alteração de
regra nesta extração.

Analytics/security globais continuam aposentados: 410 `Endpoint retired`, sem
identidade, SQL ou produtor de telemetria, também no serviço. Provas, limitações
dos indicadores e configuração legada preservada estão na
[onda 53 da API compartilhada](shared-api-host.md). Os exemplos abaixo são a
documentação anterior da UI; esta onda não modificou telas ou estilos.

### **Componentes de Dashboard**

#### **1. StatsCard**

```tsx
interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    trend: "up" | "down"
  }
  icon: React.ReactNode
}

export function StatsCard({ title, value, change, icon }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change && (
              <p
                className={cn(
                  "text-sm flex items-center gap-1",
                  change.trend === "up" ? "text-green-600" : "text-red-600"
                )}
              >
                {change.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(change.value)}%
              </p>
            )}
          </div>
          <div className="text-orange-600">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### **2. ChartCard**

```tsx
interface ChartCardProps {
  title: string
  data: any[]
  type: "line" | "bar" | "pie"
}

export function ChartCard({ title, data, type }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Integração com Recharts ou Chart.js */}
        <ResponsiveContainer width="100%" height={300}>
          {type === "line" && <LineChart data={data}>...</LineChart>}
          {type === "bar" && <BarChart data={data}>...</BarChart>}
          {type === "pie" && <PieChart data={data}>...</PieChart>}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

> Nota de estabilidade (2026-02-14): para evitar warnings do Recharts
> (`width(-1)/height(-1)`) em montagens iniciais, priorize o `ChartContainer`
> compartilhado (`packages/ui/src/web/Chart.web.tsx`), que aguarda o container
> ter dimensao valida antes de montar o `ResponsiveContainer`.

### **Botão de ações em tabelas (Ver Detalhes / Exibir)**

Em todas as páginas do painel admin que exibem tabelas com ação "Ver Detalhes",
use o **mesmo padrão da página `/admin/financeiro`**:

- **Gatilho**: botão ícone 32×32px (`h-8 w-8`) com `MoreHorizontal`, variante
  `ghost`, classes
  `border border-gray-200 bg-white shadow opacity-0 transition-all group-hover:opacity-100 hover:shadow-md hover:text-orange-600`.
- **Dropdown**: `DropdownMenu` com `DropdownMenuTrigger asChild`, conteúdo
  `align="end"` e `className="w-44"`.
- **Item de menu**: `DropdownMenuItem` com ícone `Eye` e texto "Exibir",
  chamando a ação de abrir detalhes (ex.: `setSelectedRental`,
  `openQuoteDetails`).

Referência de implementação:
`packages/frontend/src/pages/financeiro/ui/FinanceiroPage.web.tsx` (coluna de
ações da tabela de lançamentos); o host web só monta a página.

---

## 📋 Páginas Administrativas Específicas

### **Gerenciamento de Locações (`/admin/rentals`)**

#### **⚠️ Comportamento Crítico do Filtro Padrão**

A página de locações
(`packages/frontend/src/pages/locacoes/ui/LocacoesPage.web.tsx`, modelo
`model/carga.ts` e variante native da slice) **DEVE** exibir por padrão apenas
as locações com status **"Pendente" (PENDING)**, similar ao comportamento da
primeira seção na página de configurações (`/admin/settings`).

**Implementação Obrigatória:**

```tsx
// ⚠️ CRÍTICO: Filtro padrão deve ser 'PENDING' para exibir pendentes por padrão
// Similar ao comportamento da primeira seção em /admin/settings
// NUNCA alterar para 'all' sem consultar o usuário
const [statusFilter, setStatusFilter] = useState<string>("PENDING")
```

**Por que isso é importante:**

1. **UX Consistente**: Mantém o mesmo padrão de comportamento da página de
   configurações
2. **Foco Operacional**: Administradores geralmente precisam ver pendências
   primeiro
3. **Performance**: Reduz a quantidade inicial de dados carregados

**⚠️ REGRA CRÍTICA**:

- **NUNCA** altere o valor inicial de `statusFilter` de `'PENDING'` para `'all'`
  sem consultar explicitamente o usuário
- **SEMPRE** mantenha o comentário explicativo no código
- **SEMPRE** documente qualquer mudança neste comportamento

**Histórico:**

- **Data**: Janeiro 2025
- **Motivo**: Usuário solicitou que a página exiba pendentes por padrão, similar
  ao primeiro botão em configurações
- **Status**: ✅ Implementado e documentado

---

## 🔐 Autenticação e Permissões

### **Sistema de Roles**

```typescript
enum Role {
  ADMIN = "ADMIN",
  FINANCIAL = "FINANCIAL",
  OPERATOR = "OPERATOR",
  CLIENT = "CLIENT"
}
```

### **Matriz resumida**

- `ADMIN`: acesso total.
- `FINANCIAL`: acesso apenas ao modulo financeiro (`/admin/financeiro` +
  endpoints financeiros).
- `OPERATOR`: perfil legado para operacao (orcamentos/locacoes); nao usar para
  novos acessos sem alinhamento.
- `CLIENT`: sem acesso ao `/admin/*`.

### **Principal e política no servidor**

Não autorizar locadora pelo User.role global nem por getServerSession isolado. O
adapter resolve o principal, devolve a recusa e confere o papel do vínculo antes
da consulta. Trecho real do GET em
`apps/services/api/src/app/api/admin/permissions/route.ts`:

```tsx
export async function GET(request: NextRequest) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  if (access.principal.role !== "ADMIN")
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  const permissions = await readPermissionRows(access.principal)
  return NextResponse.json({ permissions })
}
```

resolveTenantPrincipal é composto em host/private-identity sobre
createTenantPrincipalResolver; readPermissionRows consulta somente a locadora do
principal. Rotas granulares usam host/permissions e
createTenantPermissionResolver: CLIENT recusa, ADMIN do vínculo passa e os
demais dependem da Permission tenant/role/module/action. Ocultar menu não
autoriza API. O antigo exemplo requireRoles por sessão global foi substituído
por este fluxo; não restaurar esse bypass após F.

### **Navegação por role**

- No host web, o portão do painel (`PrivateAreaGate` de RuntimeBootstrap com
  `resolveAdminRoleRedirect`, onda 135) redireciona FINANCIAL para
  /admin/financeiro quando tenta abrir outras telas administrativas e leva quem
  não é ADMIN de `/admin/settings` para `/admin`.
- Carregamento das rotas do painel no host web (onda 135): `loading.tsx` em
  `admin/orcamentos` e `admin/orcamentos/[id]` (`AdminQuotesLoading` e
  `QuoteIdLoading`), `admin/categorias` (o mesmo spinner da listagem, que a raiz
  desenhava) e `admin/email` (`AdminEmailLoading`, o fallback da página), como
  os `loading.tsx` da raiz legada.
- Sidebars (`desktop` e `mobile`) filtram itens de menu por role para reduzir
  risco operacional.

### **SessionProvider no Admin (evitar redirects no refresh)**

- O host web instala AppHostProviders, que entrega hostAuth e hostApiClient a
  AppProviders/RuntimeBootstrap. A sessão e a locadora atuais têm um ciclo
  único; o PrivateAreaGate aguarda esse estado antes de montar conteúdo privado.
- **Não** instale provider de sessão adicional no layout (admin). Duplicar
  bootstraps/estado pode introduzir loading/unauthenticated e redirects no
  refresh. initialSession é uma porta opcional de AppProviders, não a promessa
  de que o host atual já enviou uma sessão lida no servidor.
- O SessionProvider no app/layout da raiz era a implementação histórica; a regra
  de evitar ciclos concorrentes permanece após sua retirada em F.

---

## 🔗 Links Relacionados

- **[../getting-started/development.md](../getting-started/development.md)** -
  Setup de desenvolvimento
- **[../guides/storybook.md](../guides/storybook.md)** - Documentação do
  Storybook
- **[design-system.md](./design-system.md)** - Sistema de design completo
- **[admin-financeiro-page.md](./admin-financeiro-page.md)** - Módulo financeiro
  dedicado
- **[admin-permissions-and-roles.md](./admin-permissions-and-roles.md)** -
  Matriz de acesso e guards
- **[../architecture/overview.md](../architecture/overview.md)** - Arquitetura
  do sistema

---

_Última atualização: 2026-02-11_

## Consumidores administrativos de documentos/pagamentos (onda 66)

Locações usa api da própria página para lista/contrato/documentos/check-in/out,
com DTOs/filtros anteriores. Orçamentos/financeiro compartilham adapter de
boleto na entidade pagamento; PDFs exclusivos nas páginas. Backend continua
autoridade de tenant, papel e status. Páginas reiniciam por
locadora/papel/usuário, detalhes capturam registro. Operação antiga não aplica
dados/sucesso na seleção nova; abort não desfaz escrita recebida. Estilos
preservados; outros consumidores, aparelhos/operação pendentes. Provas na onda
66 de [API compartilhada](shared-api-host.md).

## Consumidores do catálogo (onda 68, 2026-10-03, sem commit)

Categorias, lista/criação/edição/detalhe de equipamento e gerenciador de
unidades consomem HttpClient configurado, conservando métodos, corpos, status,
filtros, preços por período, estoque, perdas e links. Adapters pertencem às
páginas; regras e ACL/CSRF/RLS continuam no catálogo/identidade do backend
compartilhado. Páginas reiniciam por locadora/papel/usuário/registro; formulário
de categoria ou unidade tem ciclo separado. Cancelar não desfaz escrita remota
aceita.

Edição preserva erro não JSON/statusText. 43 casos focados, três HTTP por motor,
182 casos do host web/52 mobile, tipos/gates/builds aprovados. AST conserva 478
atributos de estilo e sete corpos em oito fontes. Legado permanece ativo.
Medidores Decimal chegam como texto, mas o renderizador legado ainda assume
número em toFixed: correção e prova renderizada pendentes. Demais consumidores,
aparelhos/SaaS/operação também. Ver [onda 68](shared-api-host.md).

## Operações administrativas pelo transporte (onda 69, 2026-10-03, sem commit)

Dashboard, manutenção e logística usam o transporte configurado, com regras
exclusivamente no backend. Leituras paralelas, falhas parcial/principal,
pesquisa, paginação e PATCHs preservados. Páginas reiniciam por
locadora/papel/usuário; cancelar edição invalida o ciclo do formulário, sem
desfazer escrita remota.

A pendência dos medidores da onda 68 foi corrigida: number|string|null com a
mesma precisão e ocultação de null. Cinco casos renderizados protegem o
contrato. 54 casos focados únicos, tipos/gates/builds aprovados; aparelho e
aceite interativo ainda pendentes. Próximo: comunicações/configuração. Relatório
e limites na [onda 69](shared-api-host.md).

## Consumidores de configuração/comunicações (onda 70, 2026-10-03)

Settings carrega/salva e sobe logo via HttpClient: file/type=logo em multipart,
sem Content-Type manual. Formulário/defaults/mensagens e payload completo
permanecem. Confirmar um reset da tela encerrada não grava; a espera anterior
também confere o ciclo antes do PUT. Provider preserva dados no refresh e limpa
somente na troca de transporte.

Permissões, Zoho e WhatsApp possuem adapters privados e ciclos de tela/registro/
formulário. OAuth navega pelo web. Regras/ACL/RLS continuam no backend, sem
duplicação ou mudança funcional do servidor. Provas e limitações:
[onda 70](shared-api-host.md). Nativo/SaaS/operação permanecem pendentes.

## Entrada do dashboard Expo (onda 71, 2026-10-03, sem commit)

/admin/dashboard agora renderiza DashboardPage.native da slice dashboard.
Indicadores, cinco KPIs financeiros, tendências, sete gráficos/tabelas, expansão
em Dialog, ações rápidas e orçamentos recentes usam as quatro consultas e DTOs
existentes. Tipos universais são separados da configuração web de ícones;
Recharts e a apresentação web permanecem intactos.

Wrappers reiniciam por locadora/papel/slug/usuário/transporte. Respostas antigas
não reabrem painel nem repõem dados; voltar/sair usa callbacks do host Expo.
Gráficos usam componentes nativos do design system. Testes de interação e
exports/source maps passaram, mas aparelhos, fidelidade visual e vários destinos
administrativos ainda não estão completos. Ver [onda 71](shared-api-host.md).

## Catálogo administrativo Expo (onda 76, 2026-10-03, sem commit)

Lista e detalhe de equipamento passam a existir em /admin/equipamentos e
/admin/equipamentos/[id] no Expo. Modelos de lista/detalhe/unidades atendem
web/native; confirmação e navegação são portas. Formulário de unidade preserva
DTO, estados e medidores; Notas mantém rótulo acessível. API, ACL e RLS
continuam no backend existente, sem handlers duplicados.

Scope inclui locadora/papel/usuário/sessão/registro/transporte. Cancelar não
grava; confirmar depois de mudar o ciclo não apaga o registro antigo; falha
mantém seleção/rascunho. AST conserva 357 atributos web. 46 casos focados,
host/type/gates/builds aprovados; aparelhos não certificados.

Criação/edição de equipamento e categorias ainda exigem destinos Expo completos;
seus links conservam as URLs existentes. Não tratar catálogo nativo como
integralmente concluído. Provas, arquivos e próximos cortes na
[onda 76](shared-api-host.md).

## Formulários de equipamento Expo (onda 77, 2026-10-03, sem commit)

Novo/editar agora têm rotas Expo finas sobre modelos comuns. Configuração inclui
campos básicos, categoria, estoque, disponibilidade, quatro períodos/valores/
descontos, popular, preview, especificações e imagens com seleção/upload real. O
picker pertence ao host; multipart segue pelo transporte configurado.

Perdas têm calendário, fotos separadas, contador, edição/remoção confirmada e
PUT imediato. Falha reverte histórico/contador; cancelar seleção ou trocar ciclo
não contamina outro rascunho/registro. Web conserva 293 atributos visuais com
ImageUpload. Nenhuma regra/ACL/RLS/HTTP mudou. Ver
[onda 77](shared-api-host.md).

Categorias com ícones, demais destinos, aparelhos/fidelidade visual, SaaS e
operação continuam pendentes. Exports não substituem aceite em dispositivo; a
antiga app/ e o scheduler permaneciam ativos naquele checkpoint anterior ao
corte F.

## Categorias administrativas Expo — onda 78 (2026-10-03, sem commit)

A rota /admin/categorias monta a slice de produto: lista, busca/página nove,
detalhe, criação/edição/exclusão e personalização de ícones. category-form e
carga concentram modelos comuns; host seleciona/lê SVG. Bloco.native reutiliza
ícones/emoji/recents e upload/URL. Payload/409/placement/cores preservados.

Preview nativo representa cartão/badge e aba; animação, teclado, scroll,
overlays/SVG e fidelidade visual em aparelho exigem aceite.
[Implementação e limites](shared-api-host.md), onda 78; entrada 261 de issues.
API/segurança/scheduler não substituídos.

## Locações administrativas Expo — onda 79 (2026-10-03, sem commit)

Lista, filtros, paginação dez, detalhe, contrato, check-in/check-out e
documentos em /admin/rentals reutilizam useRentalsData e adapters do web. Picker
local e abertura de URL ficam no host; modelo acrescenta type/captureMetadata e
descarta seleção antiga. Status/documentos obrigatórios e payloads preservados.

Agenda nativa por dia/semana/mês respeita createdat de pendentes e intervalos;
não certifica a grade/colunas visuais do calendário web. Aparelhos, documentos/
links reais, demais fluxos administrativos, SaaS e operação pendentes.
Backend/ACL/RLS e legado intactos. [Provas e limites](shared-api-host.md),
onda 79.

## Orçamentos administrativos Expo — onda 80 (2026-10-03, sem commit)

/admin/orcamentos e caminho por ID compartilham busca/filtros/paginação/detalhe,
aprovação, rejeição, boleto/vencimento, edições, reajustes e multa com o web.
Hosts só leem parâmetros/abrem URLs/compartilham bytes; regras/202/409 e
sequência parcial seguem no backend/modelo. Facades Next/animação/badges
permanecem web.

Agenda e pipeline são adaptações funcionais; datas AAAA-MM-DD, visual/gestos/
teclado/arquivo/aparelho exigem aceite. Financeiro mobile ainda pendente, sem
link fictício. 47 focados/62 mobile/183 web, tipos/gates/builds locais
aprovados; legado intacto. [Provas e limites](shared-api-host.md), onda 80;
entrada 263.

## Financeiro administrativo Expo — onda 81 (2026-10-03, sem commit)

/admin/financeiro usa modelos/API comuns: lista dez, filtros/seleção/exportação,
calendário, indicadores, alíquotas e detalhe com status/vencimento/reemissão,
ofício, reajustes e exclusão confirmada. 202/negativas/centavos/ACL/RLS
continuam no contrato/backend. Dashboard/orçamento têm atalhos reais e
search/quoteId.

122 casos do bloco/62 mobile/183 web e gates locais aprovados. Aparelho, visual,
arquivos reais e operação continuam pendentes. Legado ativo; ver
[onda 81](shared-api-host.md), entrada 264.

## Logística/manutenção administrativas Expo — onda 82 (2026-10-03, sem commit)

Dashboard abre /admin/logistics e /admin/maintenance. Modelos/contratos comuns
protegem lista/filtros/página dez, detalhes, agenda e edição/status/checklist/
fotos de logística. Picker/imagem ficam no host; upload usa transporte
autenticado e descarta seleção antiga. Manutenção mantém consulta, sem inventar
escrita.

Nova Entrega/Agendar Manutenção continuam em desenvolvimento como no web.
Calendário por recurso/dia é adaptado; grade/Gantt/gestos e visual/aparelho
aguardam aceite. 76 focados/62 Expo/183 web, tipos/gates/builds/exports
aprovados. Legado ativo; [onda 82](shared-api-host.md), entrada 265.

## Configurações/permissões Expo — onda 83 (2026-10-03, sem commit)

/admin/settings monta as seis seções observadas com modelo/API comuns. GET/PUT
integral, defaults e reset confirmado mantidos; logo/carrossel usam upload
autenticado, com picker/imagem no host. A fachada web conserva DOM e feedback
JSX; seção encerrada não retoma seleção antiga mesmo ao voltar.

/admin/permissions já era nativa; matriz ADMIN bloqueada e perfil selecionado
foram caracterizados. Dashboard liga os dois destinos. 50 focados/64 mobile/ 183
web, tipos/gates/builds/exports aprovados. Previews nativos são funcionais;
desenho/SVG/gestos/teclado/aparelhos aguardam fidelidade/aceite. Legado ativo;
[onda 83](shared-api-host.md), entrada 266.

## Comunicações Expo — onda 84 (2026-10-03, sem commit)

Dashboard abre /admin/email e /admin/whatsapp, rotas finas das slices
existentes. Modelos comuns preservam ações, payloads, confirmações e escopo;
capacidade de aparelho fica no host. Configuração HTML isolada e conexão Zoho
via painel web autenticado não certificam uso em aparelho/provedor. Datas do
e-mail são AAAA-MM-DD neste corte; resize/visual/gestos aguardam aceite. Legado
ativo. [Provas e próximos cortes](shared-api-host.md), entrada 267 de issues.

## Consulta da assinatura — onda 105 (2026-10-04, sem commit)

Dashboard e menus abrem /admin/assinatura apenas após consulta autorizada do
dono. Papel ADMIN habilita a consulta, mas não comprova propriedade; equipe sem
ownerUserId confirmado pelo backend não recebe o item ou dados comerciais. Web
mostra plano/uso/faturas; Expo mostra estado e abre o painel no navegador. Não
há compra, alteração ou cancelamento nesta tela. Troca de vínculo/usuário/
locadora invalida dados imediatamente. Conteúdo fica na slice compartilhada,
hosts e legado só montam adapters.
[Comportamento e provas](assinatura-plataforma.md#consulta-do-dono-no-webexpo-onda-105-2026-10-04-sem-commit).

## Primeiros passos do dono — onda 116 (2026-10-04, sem commit)

Dashboard web e Expo montam o widget compartilhado de onboarding, inclusive
quando os indicadores do painel falham. ADMIN habilita a consulta, mas o backend
confirma propriedade. Locadoras antigas sem assinatura não recebem um checklist
inventado. Etapas e ordem vêm dos fatos privados do servidor; trocas de
usuário/vínculo/locadora invalidam respostas e confirmação.

Web pede confirmação explícita de publicação e só conclui a etapa após reler o
checklist. Expo abre o dashboard do painel web configurado sem transportar
tokens; não publica pelo app. Links de equipamento/configuração/assinatura são
os existentes. Wizard /comecar, recebimentos, S13 e operação ainda pendentes.
[Comportamento e limites](onboarding-locadora.md#checklist-no-dashboard-onda-116).
