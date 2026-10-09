# 🚀 Guia de Desenvolvimento - GB Locações

> **Guia completo para desenvolvedores trabalhando no projeto GB-Locações**

## 📋 Índice

- [🎯 Introdução](#-introdução)
- [🛠️ Setup do Ambiente](#️-setup-do-ambiente)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [🎨 Padrões de Desenvolvimento](#-padrões-de-desenvolvimento)
- [🧪 Testes](#-testes)
- [🔧 Debugging](#-debugging)
- [📚 Recursos](#-recursos)

---

## 🎯 Introdução

Este guia fornece todas as informações necessárias para desenvolvedores
trabalharem no projeto GB-Locações de forma eficiente e consistente.

### 🎯 Objetivos

- **Consistência** - Padrões uniformes de código
- **Qualidade** - Código limpo e testável
- **Performance** - Otimizações contínuas
- **Colaboração** - Trabalho em equipe eficiente

---

## 🛠️ Setup do Ambiente

### 📋 Pré-requisitos

```bash
# Node.js 20+
node --version  # v20.0.0 ou superior

# PNPM 10+
pnpm --version  # v10.0.0 ou superior

# Git
git --version   # v2.0.0 ou superior
```

### ⚡ Instalação Rápida

```bash
# 1. Clone o repositório
git clone https://github.com/GBLocacoes/GB-Locacoes.git
cd GB-Locacoes

# 2. Instale as dependências
pnpm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas configurações

# 4. Configure o banco de dados (migrations com RLS; nunca db push)
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm db:seed

# 5. Inicie o servidor de desenvolvimento
pnpm dev
```

### 🔧 Configuração do IDE

#### **Visual Studio Code** (Recomendado)

Extensões essenciais:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "ms-playwright.playwright"
  ]
}
```

#### **Cursor IDE** (Configuração específica)

Ver [../internal/cursor-setup.md](../internal/cursor-setup.md) para setup
completo.

---

## 📁 Estrutura do Projeto

### 🗂️ Visão Geral

```
GB-Locacoes/
├── 📁 apps/clients/web/       # Host Next.js fino: rotas, bootstrap e proxy
├── 📁 apps/clients/mobile/    # Host Expo fino
├── 📁 packages/frontend/      # Frontend do produto em FSD (app, pages, widgets,
│                              #   features, entities, shared)
├── 📁 packages/ui/            # Design system (.web/.native sobre um contrato)
├── 📁 packages/design-tokens/ # Tokens e temas canônicos
├── 📁 packages/backend/       # Módulos de servidor (identidade, cobrança...)
├── 📁 packages/domain/        # Regras de negócio puras (dinheiro em Decimal.js)
├── 📁 packages/contracts/     # Contratos compartilhados (zod)
├── 📁 app/                    # Raiz legada: rotas /api (o backend do host web)
├── 📁 lib/                    # Servidor e utilitários da raiz legada
├── 📁 middlewares/, schemas/, types/  # Auxiliares da raiz legada
├── 📁 prisma/                 # Schema e migrations (RLS por locadora)
├── 📁 tools/                  # Gates: arch, tokens, ratchet-guard, hygiene
├── 📁 tests/                  # Suítes (unit, security, identity, contract...)
└── 📁 stories/                # Storybook stories
```

As pastas `components/`, `hooks/` e `stores/` da raiz não existem mais: os
componentes estão em `packages/ui` e nas fatias de `packages/frontend`, e o
estado (Zustand) no `model` da fatia dona. A regra de camadas é o contrato do
`AGENTS.md` (seção "Context Window") e o `pnpm arch` a confere.

### 📝 Convenções de Nomenclatura

#### **Arquivos e Pastas**

```bash
# Componentes React - PascalCase, com a variante de plataforma (.web/.native)
packages/ui/src/web/Button.web.tsx
packages/frontend/src/widgets/cabecalho-admin/ui/Cabecalho.web.tsx

# Hooks - kebab-case com prefixo use-, dentro da fatia dona
packages/frontend/src/entities/configuracao/api/use-public-settings.ts

# Utilitários - kebab-case
lib/api-response.ts
packages/frontend/src/shared/lib/formatting.ts

# Tipos - declarações globais em types/, tipos de domínio no model da fatia
types/next-auth.d.ts
packages/frontend/src/entities/equipamento/model/preco.ts

# Páginas - kebab-case (Next.js convention)
app/admin/equipamentos/page.tsx
app/orcamento/page.tsx
```

#### **Variáveis e Funções**

```typescript
// Variáveis - camelCase
const equipmentList = await fetchEquipments()
const userEmail = user.email

// Funções - camelCase
function calculateTotal(items: QuoteItem[]) {}
const formatPrice = (value: number) => {}

// Constantes - UPPER_SNAKE_CASE
const API_ENDPOINTS = {
  EQUIPMENTS: "/api/equipments",
  CATEGORIES: "/api/categories"
}

// Componentes - PascalCase
const EquipmentCard = ({ equipment }: Props) => {}
export default function AdminDashboard() {}
```

---

## 🎨 Padrões de Desenvolvimento

### 🧩 Componentes React

#### **Estrutura Padrão**

```typescript
'use client' // Se necessário

import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

// Definição de variantes (se aplicável)
const componentVariants = cva(
  'base-classes',
  {
    variants: {
      variant: {
        default: 'default-classes',
        secondary: 'secondary-classes'
      },
      size: {
        default: 'default-size',
        large: 'large-size'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

// Interface de propriedades
export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Props específicas
  title?: string
  description?: string
}

// Componente principal
const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, title, ...props }, ref) => {
    return (
      <div
        className={cn(componentVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {title && <h3>{title}</h3>}
        {props.children}
      </div>
    )
  }
)
Component.displayName = 'Component'

export { Component, componentVariants }
```

#### **Custom Hooks**

```typescript
// exemplo: packages/frontend/src/entities/<fatia>/api/use-equipment-data.ts
import { useState, useEffect } from "react"
import type { Equipment } from "@/types"

interface UseEquipmentDataReturn {
  equipment: Equipment[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useEquipmentData(): UseEquipmentDataReturn {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEquipment = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/equipments")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setEquipment(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEquipment()
  }, [])

  return {
    equipment,
    isLoading,
    error,
    refetch: fetchEquipment
  }
}
```

### 🗃️ API Routes

#### **Estrutura Padrão com Imports Dinâmicos**

```typescript
// app/api/equipments/route.ts
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    // ✅ Import dinâmico do Prisma (OBRIGATÓRIO)
    const { prisma } = await import("@/lib/prisma")
    await prisma.$connect()

    // Sua lógica aqui
    const equipments = await prisma.equipment.findMany()

    return NextResponse.json(equipments)
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

#### **Validação com Zod**

```typescript
import { z } from "zod"

const createEquipmentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  pricePerDay: z.number().positive("Preço deve ser positivo"),
  categoryId: z.string().uuid("ID da categoria inválido")
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createEquipmentSchema.parse(body)

    // Continua com validatedData...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    // Outros erros...
  }
}
```

### 🎨 Styling com Tailwind

#### **Classes Recomendadas**

```typescript
// ✅ Use classes utilitárias
const Button = () => (
  <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
    Clique aqui
  </button>
)

// ✅ Use cn() para combinações condicionais
const Alert = ({ variant }: { variant: 'success' | 'error' }) => (
  <div className={cn(
    'p-4 rounded-md',
    variant === 'success' && 'bg-green-100 text-green-800',
    variant === 'error' && 'bg-red-100 text-red-800'
  )}>
    Mensagem
  </div>
)

// ✅ Componentes com variant/size + className: variant primeiro, className por último.
// O cn() usa tailwind-merge; o último argumento prevalece em conflitos.
// Ordem correta: base, sizeClasses[size], variantClasses[variant], className
```

#### **Responsividade**

```typescript
// Mobile-first approach
const ResponsiveGrid = () => (
  <div className="
    grid
    grid-cols-1          // Mobile: 1 coluna
    md:grid-cols-2       // Tablet: 2 colunas
    lg:grid-cols-3       // Desktop: 3 colunas
    xl:grid-cols-4       // Desktop grande: 4 colunas
    gap-4
    p-4
  ">
    {/* Conteúdo */}
  </div>
)
```

---

## 🧪 Testes

### 🎯 Estratégia de Testes

```typescript
// Testes unitários - colocados junto do arquivo: packages/ui/src/web/Button.web.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  test('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  test('handles click events', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })
})
```

### 📊 Comandos de Teste

```bash
# Testes unitários
pnpm test                 # Executar todos os testes
pnpm test:watch           # Modo watch
pnpm test:coverage        # Relatório de cobertura
pnpm test:ui              # Interface visual

# Testes E2E
pnpm playwright test      # Executar Playwright
pnpm playwright test --ui # Interface Playwright

# Storybook
pnpm storybook           # Desenvolvimento
pnpm build-storybook    # Build do Storybook
```

---

## 🔧 Debugging

### 🐛 Debugging no VSCode

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### 📊 Logging

```typescript
// Estruturado com Pino
import { logger } from "@/lib/logger"

// Em desenvolvimento
logger.info("Equipment created", {
  equipmentId: equipment.id,
  userId: user.id
})

// Em produção
logger.error("Database connection failed", {
  error: error.message,
  stack: error.stack
})
```

### 🔍 Debugging de API

```typescript
// Middleware para debug
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Sua lógica aqui
    const result = await fetchData()

    console.log(`[API] ${request.url} - Success in ${Date.now() - startTime}ms`)
    return NextResponse.json(result)
  } catch (error) {
    console.error(
      `[API] ${request.url} - Error in ${Date.now() - startTime}ms:`,
      error
    )
    throw error
  }
}
```

---

## 📚 Recursos

### 🔗 Links Úteis

- **[Prisma Client](../internal/prisma-client-regeneration.md)** - Regeneração
  do Prisma Client
- **[Storybook Guide](../guides/storybook.md)** - Documentação do Storybook
- **[API](../architecture/api.md)** - Referência da API
- **[Dependencies](../references/dependencies.md)** - Compatibilidade de
  dependências

### 📖 Documentação Externa

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/primitives)

### 🛠️ Ferramentas

```bash
# Análise de código
pnpm lint                    # ESLint (verificar problemas)
pnpm lint:fix                # ESLint (corrigir automaticamente)
pnpm lint:all                # ESLint (corrigir + verificar)
pnpm format                  # Prettier (formatar código)
pnpm format:md               # Prettier (formatar apenas Markdown)
pnpm format:all              # Prettier (formatar código + Markdown)
pnpm type-check              # TypeScript

# Qualidade
pnpm quality:check           # Verificação completa
pnpm quality:fix             # Correção automática

# Compatibilidade
pnpm type-check             # Verificar tipos TypeScript
pnpm update:safe             # Atualizar seguramente
```

---

## 🆘 Solução de Problemas

Para problemas comuns, consulte:

- **[troubleshooting.md](./troubleshooting.md)** - Problemas gerais
- **[prisma-client-regeneration.md](../internal/prisma-client-regeneration.md)** -
  Problemas do Prisma Client
- **[deployment.md](./deployment.md)** - Problemas de deploy (CI em
  `.github/workflows/README.md`)

---

_Última atualização: dezembro 2024_
