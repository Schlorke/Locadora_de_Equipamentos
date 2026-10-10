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
# Node.js conforme .node-version e engines
node --version  # 24.21.0; >=24.21.0 <25

# PNPM conforme packageManager
pnpm --version  # 10.27.0

# Git
git --version   # v2.0.0 ou superior
```

### ⚡ Instalação Rápida

```bash
git clone https://github.com/Schlorke/Locadora_de_Equipamentos.git
cd Locadora_de_Equipamentos
pnpm install --frozen-lockfile
pnpm db:generate
# Somente depois de apontar Prisma para um PostgreSQL próprio local:
pnpm exec prisma migrate deploy
pnpm dev
```

Use os templates de cada host: `apps/services/api/.env.example`,
`apps/clients/web/.env.example` e `apps/clients/mobile/.env.example`. Os
arquivos privados não são versionados. Configure apenas o ambiente local deste
produto e um PostgreSQL próprio; nunca reutilize conexões, indicadores de deploy
ou credenciais da GB. Banco hospedado e provedores serão escolhidos em uma etapa
posterior. Mantenha as integrações desligadas conforme os templates; não execute
seed ou scripts operacionais como parte do setup.

A API usa `http://127.0.0.1:3002`; o web de desenvolvimento usa a porta 3001 e
encaminha `/api/*` para `WEB_API_ORIGIN`. A configuração do domínio local
precisa obedecer à [ADR de hosts](../architecture/adr-tenant-hosts.md). O
cliente móvel inicia separadamente com
`pnpm --filter @gb-locacoes/mobile start`; configure sua origem de API pelo
template do host, não por um fallback para produção.

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

```text
Locadora_de_Equipamentos/
├── apps/clients/web/        # Next: rotas, bootstrap, proxy e integração de plataforma
├── apps/clients/mobile/     # Expo: bootstrap e integração nativa
├── apps/services/api/       # Next: src/app/api e composição em src/host
├── packages/frontend/src/  # FSD: app → pages → widgets → features → entities → shared
├── packages/ui/            # Contratos e implementações web/native do design system
├── packages/design-tokens/ # Tokens e temas canônicos
├── packages/backend/src/   # modules/, http/ e runtime/; somente servidor
├── packages/domain/        # Regras puras, sem dependências dos hosts
├── packages/contracts/     # Schemas e contratos compartilhados
├── types/                  # Inclui next-auth.d.ts; não é apagada com a raiz antiga
├── public/                 # Assets compartilhados e OpenAPI
├── prisma/                 # Schema e migrations com RLS
├── tools/                  # Gates e geração do Prisma
├── scripts/                # Ferramentas conservadas; operações exigem runbook
├── tests/                  # Suítes e ferramentas de prova
├── stories/                # Storybook
└── docs/                   # Guias, decisões e runbooks
```

As pastas `app/`, `lib/`, `middlewares/` e `schemas/` da raiz foram aposentadas.
Não restaure uma fachada para resolver imports: componha o serviço em
`apps/services/api/src/host` ou consuma o contrato público do package dono.
`types/next-auth.d.ts`, `public/` e `prisma/` permanecem.

Componentes, hooks e stores do produto ficam no design system ou na fatia FSD
dona. Uma fatia importa somente camadas abaixo dela por APIs públicas; as
exceções de cross-import de entities são explícitas em `@x`. O contrato de
`AGENTS.md` e `pnpm arch` governam essas fronteiras.

### 📝 Convenções de Nomenclatura

#### **Arquivos e Pastas**

```bash
# Componentes React - PascalCase, com a variante de plataforma (.web/.native)
packages/ui/src/web/Button.web.tsx
packages/frontend/src/widgets/cabecalho-admin/ui/Cabecalho.web.tsx

# Hooks - kebab-case com prefixo use-, dentro da fatia dona
packages/frontend/src/entities/configuracao/api/use-public-settings.ts

# Utilitários - kebab-case
packages/backend/src/http/success-response.ts
packages/frontend/src/shared/lib/formatting.ts

# Tipos - declarações globais em types/, tipos de domínio no model da fatia
types/next-auth.d.ts
packages/frontend/src/entities/equipamento/model/preco.ts

# Páginas - kebab-case (Next.js convention)
apps/clients/web/src/app/(admin)/admin/equipamentos/page.tsx
apps/clients/web/src/app/(public)/[locadora]/(vitrine)/orcamento/page.tsx
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

// Exemplo interno a packages/ui/src/web: cn não é exportado pela raiz do package.
import { cn } from './cn'
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

Coloque o hook na fatia dona e use os contratos compartilhados.
`packages/frontend/src/entities/configuracao/api/use-public-settings.ts` é um
exemplo real: usa `useApiClient` de `shared/api` e recebe a locadora pela API
`@x` de organização. Não use tipos da raiz aposentada nem uma requisição global
que omita o contexto da locadora.

A infraestrutura HTTP está em `packages/frontend/src/shared/api/http-client.ts`
e `ApiClientProvider.tsx`. Os hosts configuram transporte e origem; a fatia não
importa bootstrap do host web nem implementações do backend.

### 🗃️ API Routes

#### **Composição do host da API**

```typescript
// apps/services/api/src/app/api/equipments/route.ts (composição existente)
import { publicEquipments } from "../../../host/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0
export const GET = publicEquipments
```

O runtime compõe as factories de `packages/backend`; não existe mais
`@/lib/prisma` na raiz. O catálogo público exige `tenantSlug` e não escolhe uma
locadora por padrão. Em rotas privadas, a identidade, o vínculo e a permissão
granular são resolvidos antes da operação; o módulo executa com
`withTenantTransaction`. Não substitua esse fluxo por `findMany()` global.

#### **Validação com contratos compartilhados**

`apps/services/api/src/app/api/admin/settings/route.ts` usa `SettingsSchema` de
`@gb-locacoes/contracts/settings`, `requireTenantPermission` e verificação de
origem na escrita. Schemas compartilhados pertencem a `packages/contracts`; as
regras puras pertencem a `packages/domain`. Use o contrato real da rota, não um
schema demonstrativo copiado deste guia.

### 🎨 Styling com Tailwind

#### **Classes Recomendadas**

Reutilize os componentes de `@gb-locacoes/ui`. O contrato de Button em
`packages/ui/src/contract/button.ts` mantém `default` com Slate e `outline` para
cancelar; o token laranja de marca não autoriza trocar a cor de uma ação.
Consulte [design-system.md](../features/design-system.md).

```tsx
import { Button } from '@gb-locacoes/ui'

<Button variant="default">Salvar</Button>
<Button variant="outline">Cancelar</Button>
```

Use `cn()` do dono da implementação para combinar classes: base, tamanho,
variante e `className` por último. Classe nova precisa conservar a semântica da
produção; `!important`, valores próprios de z-index e sobrescritas globais sem
dono são proibidos.

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
import { Button } from './Button.web'

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
pnpm test:unit
pnpm test:web
pnpm test:mobile
pnpm test:all        # Suítes consolidadas definidas no package.json
pnpm test:watch      # Config padrão; não representa todas as suítes
pnpm test:coverage   # Cobertura da config padrão
pnpm test:ui
pnpm storybook
pnpm build-storybook
```

`pnpm test` usa somente a configuração padrão do Vitest; não significa “todos os
testes”. HTTP API, jornadas Playwright e captura/comparação visual têm
configurações e pré-condições próprias: banco descartável, ambiente
neutralizado, builds coerentes com o motor e artefatos externos. Siga
[testing.md](../guides/testing.md) e `tests/visual/README.md`.

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
      "url": "http://localhost:3001"
    }
  ]
}
```

### 📊 Logging

O logger de aplicação é criado no servidor por `createApplicationLogger` de
`@gb-locacoes/backend/runtime` (`packages/backend/src/runtime/logger.ts`). A
composição em `apps/services/api/src/host/communications.ts` usa essa factory
com o ambiente do processo; não importa `@/lib/logger` da raiz aposentada.

```typescript
import { createApplicationLogger } from "@gb-locacoes/backend/runtime"

const logger = createApplicationLogger(process.env)
logger.info({ event: "equipment.created", equipmentId }, "Equipment created")
```

Não registre URL com parâmetros, corpo de autenticação, cookies, tokens,
connection strings ou mensagens brutas de provedor. A política de redação não
substitui a escolha explícita de campos seguros. Para diagnosticar uma rota,
registre status, duração e identificadores não secretos; preserve o erro para o
handler sem despejar o request inteiro.

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

_Guia portado para a estrutura após a retirada local da raiz; a validação do
clone e o corte de produção têm registros próprios._
