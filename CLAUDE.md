# CLAUDE.md - GB Locações

This file provides context for AI assistants working on this codebase.

## Project Overview

**GB Locações** is a full-stack SaaS platform for equipment rental management in
Brazil, targeting construction equipment leasing. It includes:

- Equipment catalog and search
- Quote/proposal generation system
- Rental management dashboard
- Admin panel for operations
- Payment processing (Asaas, one subaccount per rental company; see
  `docs/architecture/adr-saas-subscription.md`)
- Email and logistics integrations
- Analytics and KPI tracking

## Tech Stack

| Layer           | Technology                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack); Expo 57 / React Native 0.86 on mobile                                  |
| Language        | TypeScript (strict mode)                                                                                   |
| UI              | React 19, Radix UI, Tailwind CSS 4 with the production (3.4.17) palette and scales                         |
| State           | Zustand, React Hook Form                                                                                   |
| Validation      | Zod, hand-written (`packages/contracts`; `lib/validations/index.ts` for legacy routes)                     |
| Database        | PostgreSQL + Prisma ORM (RLS per rental company in the migrations)                                         |
| Auth            | NextAuth.js 4 (`legacy` mode) and Better Auth 1.7 (multi-host identity), chosen by `NEXT_PUBLIC_AUTH_MODE` |
| Testing         | Vitest, Playwright                                                                                         |
| Package Manager | pnpm (workspace)                                                                                           |

## Key Commands

```bash
# Development
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm start            # Run production server

# Database
pnpm db:generate      # Generate Prisma client (--generator client)
pnpm exec prisma migrate deploy  # Apply migrations (never db push: RLS lives in them)
pnpm db:studio        # Open Prisma Studio GUI

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format with Prettier
pnpm type-check       # TypeScript check
pnpm quality:fix      # Format + lint + markdown fix
pnpm arch             # Architecture gate (FSD, runtime boundaries)
pnpm tokens           # Design-token gate
pnpm hygiene          # Unused files/exports/deps (knip) and tool outputs

# Testing
pnpm test             # Integration suite only (vitest.config.ts)
pnpm test:all         # Every suite (unit, security, identity, platform, mobile, web, integration)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report

# Design System
pnpm storybook        # Run Storybook on :6006
```

## Project Structure

```
apps/clients/web/     # Next.js host (thin): routes, bootstrap, proxy
apps/clients/mobile/  # Expo host (thin)
packages/frontend/    # Product frontend, Feature-Sliced Design (src/app, pages, widgets, features, entities, shared)
packages/ui/          # Design system (.web/.native variants over one contract)
packages/design-tokens/ # Canonical tokens and themes
packages/backend/     # Server modules (identity, billing, quotations, rentals...)
packages/domain/      # Pure business rules (money with Decimal.js)
packages/contracts/   # Shared contracts (zod)

app/                  # Legacy root Next.js app, still built and deployed
  api/                # API routes (RESTful): the backend the web host proxies to
lib/                  # Server and shared logic of the legacy root
  auth.ts             # NextAuth configuration
  prisma.ts           # Prisma client singleton
  validations/        # index.ts + contact-types.ts (hand-written); the zod-generator output was deleted on 2026-09-30
  payment-gateways/   # Payment processor implementations (Asaas)
middlewares/, schemas/, types/  # Legacy root helpers
tests/                # Suites (unit/, security/, identity/, contract/, api/, critical/, visual/, e2e/)
tools/                # Gates: arch, tokens, ratchet-guard, hygiene
prisma/               # Schema & migrations
docs/                 # Documentation (docs/archive/ = history)
```

## Coding Conventions

### File Naming

- Components: `PascalCase.tsx`, with `.web`/`.native` variants (e.g.,
  `Button.web.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-cart.ts`)
- Utilities: `kebab-case.ts` (e.g., `api-response.ts`)
- Stores: Zustand store in the owning slice model (e.g.,
  `packages/frontend/src/features/carrinho/model/carrinho.ts`)

### Components

- Use Radix UI primitives with Tailwind
- Server Components by default (add `'use client'` when needed)
- Use CVA (Class Variance Authority) for variants
- Use `cn()` utility for class merging

### API Routes

```typescript
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.success) return authError(auth)
  // ... handler logic
}
```

### Database

- Always use Prisma ORM (never raw SQL)
- Use `Decimal.js` for currency (never floats!)
- Validate input with hand-written Zod schemas (`packages/contracts` for shared
  contracts, `lib/validations/index.ts` for the legacy routes); Prisma generates
  only the client (the former zod generator was removed on 2026-09-30)

### State Management

- Zustand for client-side state (cart, notifications)
- React Hook Form for form state
- Server Components for server state

## Critical Rules

1. **Currency calculations**: Always use `Decimal.js`, never floats
2. **Admin routes**: Must call `requireAdmin()` middleware
3. **API routes**: Set `dynamic = 'force-dynamic'` and `revalidate = 0`
4. **Validation**: Use hand-written Zod schemas (`packages/contracts`, or
   `lib/validations/index.ts` in legacy routes)
5. **Types**: TypeScript strict mode - all types must be explicit
6. **Tests**: Critical payment/quote tests must pass before merging

## Authentication

- Roles `ADMIN`, `FINANCIAL`, `OPERATOR` (legacy) and `CLIENT`, checked on the
  membership of the selected rental company (the global `User.role` does not
  authorize; `docs/features/admin-permissions-and-roles.md`)
- NextAuth.js (`legacy` mode): JWT sessions; Better Auth: multi-host identity
  (`docs/architecture/adr-tenant-hosts.md`)
- OAuth: Google, Facebook
- Credentials with bcrypt hashing

## External Services

| Service      | Purpose                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| Asaas        | Payments (one subaccount per rental company) and the platform subscription |
| Resend       | Transactional emails                                                       |
| Zoho Mail    | Admin email integration                                                    |
| ZapSign      | Digital contract signing                                                   |
| Melhor Envio | Shipping logistics                                                         |
| Supabase     | File storage                                                               |

## Environment Setup

```bash
pnpm install                 # Install dependencies
cp .env.example .env.local   # Create env file (fill in values)
pnpm db:generate             # Generate Prisma client
pnpm exec prisma migrate deploy  # Create the schema (migrations with RLS)
pnpm dev                     # Start development server
```

Requires Node.js 24.21 (`.node-version`, `engines`) and pnpm 10.27
(`packageManager`).

## Language

The application is in Brazilian Portuguese (`pt-BR`). UI text, error messages,
and documentation are primarily in Portuguese.

## Performance Considerations

- Turbopack for dev and production builds (its own chunking; the root
  next.config.mjs has no webpack config)
- The 3D hero carousel loads on demand (next/dynamic in Hero.web.tsx)
- Lazy loading for admin dashboard components
- Console removal in production builds of the legacy root
  (compiler.removeConsole)

<!-- BEGIN context-window:agents-import v2.1.0 sha256=1250ea1687caa260b709869526b93ed44c8c8c3f71cf452570af3a7499826c3d -->

Claude Code: the shared agent instructions for this repository live in
AGENTS.md.

@AGENTS.md
<!-- END context-window:agents-import -->
