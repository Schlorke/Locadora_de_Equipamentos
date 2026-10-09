# 🤝 Guia de Contribuição - GB-Locacoes

> **Como contribuir para o projeto GB-Locacoes**

## 📋 Índice

- [🎯 Introdução](#-introdução)
- [🛠️ Setup do Ambiente](#️-setup-do-ambiente)
- [📝 Padrões de Código](#-padrões-de-código)
- [🔀 Fluxo de Trabalho](#-fluxo-de-trabalho)
- [🧪 Testes](#-testes)
- [📚 Documentação](#-documentação)
- [🔍 Code Review](#-code-review)
- [🚀 Deploy](#-deploy)

---

## 🎯 Introdução

Obrigado por considerar contribuir para o projeto GB-Locacoes! Este documento
fornece diretrizes para contribuições.

## ⚠️ **ANTES DE COMEÇAR: Compatibilidade de Dependências**

### 🚨 **CRÍTICO: Versões Bloqueadas**

**NUNCA ATUALIZAR** estas dependências sem aprovação:

```bash
# ❌ Prisma 6.14.0+ quebra o build
@prisma/client@latest  # Manter versão estável
prisma@latest          # Manter versão estável

# ❌ Tailwind 4.x quebra design system
tailwindcss@3.4.17     # MANTER
```

### ✅ **Processo Obrigatório para Atualizações**

```bash
# 1. Consultar guia ANTES de atualizar
cat DEPENDENCY_COMPATIBILITY_GUIDE.md

# 2. Atualizar apenas dependências seguras
pnpm update @radix-ui/react-*  # UI - OK
pnpm update @testing-library/* # Testing - OK

# 3. SEMPRE testar build
pnpm run build  # <- CRÍTICO!

# 4. Se quebrar, reverter IMEDIATAMENTE
git checkout package.json pnpm-lock.yaml && pnpm install
```

### 📚 **Documentação Relacionada**

- **[dependencies.md](./docs/references/dependencies.md)** - Guia completo de
  versões e compatibilidade
- **[troubleshooting.md](./docs/getting-started/troubleshooting.md)** -
  Problemas do Prisma e outros

### 🎯 Como Contribuir

- **Reportar Bugs** - Use GitHub Issues
- **Sugerir Funcionalidades** - Use GitHub Discussions
- **Enviar Pull Requests** - Siga este guia
- **Melhorar Documentação** - Sempre bem-vindo
- **Compartilhar Ideias** - Participe das discussões

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

### ⚡ Configuração Rápida

```bash
# 1. Fork o repositório
# 2. Clone seu fork
git clone https://github.com/seu-usuario/GB-Locacoes.git
cd GB-Locacoes

# 3. Adicione o repositório original como upstream
git remote add upstream https://github.com/GBLocacoes/GB-Locacoes.git

# 4. Instale dependências
pnpm install

# 5. Configure variáveis de ambiente
cp .env.example .env.local

# 6. Configure o banco (migrations com RLS; nunca db push)
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm db:seed

# 7. Inicie o desenvolvimento
pnpm dev
```

### 🔧 Configuração do VS Code

#### **Extensões Recomendadas**

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

---

## 📝 Padrões de Código

### 🎨 Style Guide

#### **TypeScript**

```typescript
// ✅ Bom
interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

type UserRole = "ADMIN" | "CLIENT"

// ❌ Evite
interface user {
  id: string
  name: string
  email: string
  role: string
}
```

#### **React Components**

```typescript
// ✅ Bom
'use client'

import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white',
        destructive: 'bg-red-600 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

#### **Formulários**

```typescript
// ✅ Bom - React Hook Form + Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
})

type FormData = z.infer<typeof formSchema>

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}
```

### 📝 Convenções de Nomenclatura

| Tipo                      | Padrão                | Exemplo           |
| ------------------------- | --------------------- | ----------------- |
| **Componentes (arquivo)** | PascalCase + variante | `Button.web.tsx`  |
| **Utilitários**           | kebab-case            | `api-response.ts` |
| **Componentes**           | PascalCase            | `EquipmentCard`   |
| **Hooks**                 | camelCase + `use`     | `useEquipment`    |
| **Types**                 | PascalCase            | `EquipmentType`   |
| **Constants**             | UPPER_SNAKE_CASE      | `API_ENDPOINTS`   |
| **Functions**             | camelCase             | `formatCurrency`  |

### 🎨 Design System

#### **Cores**

```typescript
// ✅ Use as cores do design system
const colors = {
  primary: "#ea580c", // Orange-600
  secondary: "#3b82f6", // Blue-500
  success: "#10b981", // Green-500
  warning: "#f59e0b", // Yellow-500
  error: "#ef4444" // Red-500
}
```

#### **Componentes**

```typescript
// ✅ Use componentes do design system (packages/ui)
import { Button, Card, Input } from "@gb-locacoes/ui"

// ❌ Evite criar componentes duplicados
```

---

## 🔀 Fluxo de Trabalho

### 🌿 Branches

#### **Estrutura de Branches**

```bash
main                    # Produção
├── develop            # Desenvolvimento
├── feature/equipment  # Nova funcionalidade
├── fix/login-bug      # Correção de bug
├── docs/api-update    # Documentação
└── refactor/database  # Refatoração
```

#### **Nomenclatura de Branches**

```bash
# Funcionalidades
feature/nome-da-funcionalidade
feature/equipment-management
feature/user-authentication

# Correções
fix/nome-do-bug
fix/login-validation
fix/database-connection

# Documentação
docs/nome-da-doc
docs/api-documentation
docs/setup-guide

# Refatoração
refactor/nome-do-refactor
refactor/database-queries
refactor/component-structure
```

### 📝 Commits

#### **Conventional Commits**

```bash
# Estrutura
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### **Tipos de Commit**

```bash
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação
refactor: refatoração
test: testes
chore: manutenção
perf: performance
ci: integração contínua
build: build
```

#### **Exemplos**

```bash
# ✅ Bom
feat: adiciona sistema de orçamentos
fix: corrige validação de email
docs: atualiza README com instruções de setup
style: formata código com prettier
refactor: reorganiza estrutura de componentes
test: adiciona testes para EquipmentCard

# ❌ Evite
add stuff
fix bug
update docs
```

### 🔄 Pull Request

#### **Template de PR**

```markdown
## 📋 Descrição

[Descreva brevemente as mudanças]

## 🎯 Tipo de Mudança

- [ ] Bug fix (correção que resolve um problema)
- [ ] New feature (funcionalidade que adiciona algo novo)
- [ ] Breaking change (mudança que quebra compatibilidade)
- [ ] Documentation update (atualização de documentação)

## 🔍 Como Testar

1. Clone a branch
2. Instale dependências: `pnpm install`
3. Configure variáveis de ambiente
4. Execute: `pnpm dev`
5. Teste as funcionalidades:
   - [ ] Funcionalidade A
   - [ ] Funcionalidade B

## 📸 Screenshots

[Adicione screenshots se aplicável]

## ✅ Checklist

- [ ] Código segue os padrões do projeto
- [ ] Testes foram adicionados/atualizados
- [ ] Documentação foi atualizada
- [ ] Build passa sem erros
- [ ] Linting passa sem warnings
- [ ] TypeScript não apresenta erros

## 🔗 Issues Relacionadas

Closes #123 Relates to #456
```

---

## 🧪 Testes

### 🎯 Estratégia de Testes

#### **Unit Tests**

```typescript
// packages/ui/src/web/Button.web.test.tsx: teste colocado ao lado do arquivo
// testado (pnpm check:test-names reprova teste órfão)
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button.web'

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

#### **Integration Tests**

```typescript
// exemplo: tests/api/<rota>.test.ts (rota: app/api/<rota>/route.ts)
import { describe, it, expect } from "vitest"
import { createMocks } from "node-mocks-http"
import { GET } from "@/app/api/equipments/route"

describe("/api/equipments", () => {
  it("returns equipment list", async () => {
    const { req } = createMocks({ method: "GET" })
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
```

### 🚀 Executando Testes

```bash
# Todas as suítes (unit, security, identity, platform, mobile, web, integration)
pnpm test:all

# Só a suíte de integração (vitest.config.ts)
pnpm test

# Testes em watch mode
pnpm test:watch

# Cobertura de testes
pnpm test:coverage

# Testes específicos
pnpm test Button.test.tsx

# Interface visual
pnpm test:ui
```

---

## 📚 Documentação

### 📝 Atualizando Documentação

#### **README.md**

- Mantenha sempre atualizado
- Inclua instruções claras de setup
- Documente funcionalidades principais
- Adicione exemplos de uso

#### **Documentação Técnica**

````markdown
# Nome da Funcionalidade

## Visão Geral

[Descrição da funcionalidade]

## Como Usar

```typescript
import { MyComponent } from '@gb-locacoes/ui'

export function Example() {
  return <MyComponent />
}
```
````

## Props

| Prop      | Tipo                         | Padrão      | Descrição              |
| --------- | ---------------------------- | ----------- | ---------------------- |
| `variant` | `'default' \| 'destructive'` | `'default'` | Variante do componente |

## Exemplos

[Exemplos de uso]

````

### 🎭 Storybook

```typescript
// stories/MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { MyComponent } from '@gb-locacoes/ui'

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'My Component',
  },
}
````

---

## 🔍 Code Review

### ✅ Checklist de Review

#### **Funcionalidade**

- [ ] A funcionalidade funciona conforme esperado?
- [ ] Os casos edge foram considerados?
- [ ] A validação está adequada?
- [ ] O tratamento de erros está implementado?

#### **Código**

- [ ] O código segue os padrões do projeto?
- [ ] A nomenclatura está clara e consistente?
- [ ] Não há código duplicado?
- [ ] A complexidade está adequada?

#### **Performance**

- [ ] Não há re-renders desnecessários?
- [ ] As queries estão otimizadas?
- [ ] O bundle size não aumentou significativamente?

#### **Segurança**

- [ ] A validação está adequada?
- [ ] Não há vulnerabilidades de segurança?
- [ ] Os dados sensíveis estão protegidos?

#### **Testes**

- [ ] Os testes cobrem a funcionalidade?
- [ ] Os testes passam?
- [ ] A cobertura está adequada?

#### **Documentação**

- [ ] A documentação foi atualizada?
- [ ] Os comentários estão claros?
- [ ] O README foi atualizado se necessário?

### 💬 Comentários de Review

#### **✅ Bom**

```markdown
Great work! A few suggestions:

1. Consider extracting this logic into a custom hook
2. Add error handling for the API call
3. Update the documentation to reflect these changes
```

#### **❌ Evite**

```markdown
This is wrong. Fix this. Bad code.
```

---

## 🚀 Deploy

### 🔄 Deploy Automático

O projeto usa GitHub Actions para deploy automático na Vercel.

#### **Processo**

1. **Push para `main`** → Deploy automático para produção
2. **Pull Request** → Deploy de preview
3. **Merge** → Deploy para produção

#### **Verificações**

- [ ] Build passa
- [ ] Testes passam
- [ ] Linting passa
- [ ] TypeScript não apresenta erros

### 🧪 Ambiente de Teste

```bash
# Deploy de preview
git push origin feature/minha-funcionalidade

# Acesse o link de preview na PR
```

---

## 🎯 Conclusão

### 📋 Resumo

1. **Fork** o repositório
2. **Clone** seu fork
3. **Crie** uma branch para sua feature
4. **Desenvolva** seguindo os padrões
5. **Teste** suas mudanças
6. **Documente** se necessário
7. **Envie** um Pull Request
8. **Aguarde** o review

### 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/GBLocacoes/GB-Locacoes/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/GBLocacoes/GB-Locacoes/discussions)
- **Email**: contato@locacoesgb.com.br

### 🙏 Agradecimentos

Obrigado por contribuir para o projeto GB-Locacoes! Sua contribuição é muito
importante para a comunidade.
