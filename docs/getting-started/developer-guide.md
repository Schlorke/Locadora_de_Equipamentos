# 👨‍💻 Developer Guide - GB Locações

> **Target**: Human Developers (Frontend, Backend, Full-Stack)  
> **Project**: GB Locações Equipment Rental Platform  
> **Scope**: Development after local retirement of the old root host. The
> January 2025 component examples are kept as historical notes, not current
> contracts.

## 🎯 **Quick Start for New Developers**

### **Prerequisites**

- Node.js 24.21.0 (`.node-version`; engines >=24.21.0 <25)
- pnpm 10.27.0 (`packageManager` and `pnpm-lock.yaml`)
- PostgreSQL database
- Git

### **Setup**

```bash
git clone https://github.com/Schlorke/Locadora_de_Equipamentos.git
cd Locadora_de_Equipamentos
pnpm install --frozen-lockfile
pnpm db:generate
# Configure a local database belonging to this product before this command:
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

The old root `app/`, `lib/`, `middlewares/` and `schemas/` were retired. Use
`apps/services/api/src/app/api` and `src/host` for HTTP composition,
`packages/backend/src/modules` for server modules and workspace contracts.

### **Essential Commands**

```bash
pnpm dev                   # API em 3002 e web em 3001
pnpm --filter @gb-locacoes/mobile start
pnpm build                 # Build web + API; não publica
pnpm bundle:mobile         # Export Android + iOS
pnpm test:all              # Suítes listadas no package.json; não captura E2E/visual
pnpm type-check
pnpm typecheck
pnpm lint
pnpm storybook
```

## 🧩 **Component Library Overview**

### **New Components (January 2025)**

> Registro histórico dos exemplos de janeiro de 2025, anteriores à consolidação
> das APIs dos componentes. Não copie props nem dados empresariais deste
> registro para uma locadora nova. O contrato vivo está nos `index.ts` das
> fatias e em [COMPONENT_INVENTORY.md](../COMPONENT_INVENTORY.md).

#### **QuoteForm** - Multi-step form system

```tsx
// Location: packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx
// Usage: Any quote/contact form needs

import { QuoteForm } from "@gb-locacoes/frontend/pages/orcamento"
;<QuoteForm
  variant="modal" // modal | page | inline
  prefilledEquipment={{
    // Optional pre-fill
    id: "equipment-id",
    name: "Equipment Name"
  }}
  onSuccess={(data) => {}} // Success callback
  onCancel={() => {}} // Cancel callback (modal only)
/>
```

**Features:**

- 3-step process (Contact Info → Equipment & Period → Final Details)
- Zod validation with real-time feedback
- Responsive design with animations
- Loading states and error handling
- Analytics tracking built-in

#### **CTAButton System** - Comprehensive button solution

```tsx
// Location: packages/ui/src/web/CTAButton.web.tsx
// Usage: All buttons and call-to-actions

import {
  CTAButton,
  QuoteCTA,
  ContactCTA,
  PhoneCTA,
  WhatsAppCTA
} from '@gb-locacoes/ui'

// Pre-configured CTAs (recommended)
<QuoteCTA href="/orcamento" />
<ContactCTA href="/contato" />
<PhoneCTA phone="+555123136262" />
<WhatsAppCTA
  phone="5551998205163"
  message="Olá! Gostaria de um orçamento."
/>

// Custom CTA
<CTAButton
  variant="primary"                  // primary | secondary | outline | ghost
  size="md"                          // sm | md | lg
  trackingId="custom-action"         // For analytics
  icon={<SomeIcon />}
  fullWidth
  onClick={handleClick}
>
  Custom Action
</CTAButton>
```

**Features:**

- Multiple variants and sizes
- Analytics tracking with Google gtag
- Loading states and animations
- Accessibility built-in
- Pre-configured for common actions

#### **EquipmentCard** - removido

O antigo `EquipmentCard` não tinha importador e saiu na limpeza de código de
2026-09-30. A listagem pública monta os próprios cards em
`packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.web.tsx`.

#### **Breadcrumb** - Navigation with SEO

```tsx
// Location: packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoTrilha.web.tsx
// Usage: Page navigation (interno da página de detalhe do equipamento)

import Breadcrumb, {
  EquipmentBreadcrumb,
  CategoryBreadcrumb
} from './EquipamentoTrilha.web'

// For equipment pages (pre-configured)
<EquipmentBreadcrumb
  currentPage="Betoneira 400L"
  categoryName="Betoneiras"
  categorySlug="betoneiras"
  variant="default"                  // default | minimal | pills
/>

// Custom breadcrumb
<Breadcrumb
  items={[
    { name: 'Home', href: '/' },
    { name: 'Products', href: '/products' },
    { name: 'Current Page', current: true }
  ]}
  showHome={true}
  variant="pills"
/>
```

**Features:**

- Automatic JSON-LD structured data
- 3 visual variants
- Animations and accessibility
- Pre-configured for common patterns

#### **StructuredData** - SEO structured data

```tsx
// Location: packages/frontend/src/widgets/dados-estruturados (StructuredData)
// e packages/frontend/src/entities/configuracao (DEFAULT_LOCAL_BUSINESS)
// Usage: SEO enhancement for pages (import pela API pública de cada fatia)

import { StructuredData } from "../../../widgets/dados-estruturados"
import { DEFAULT_LOCAL_BUSINESS } from "../../../entities/configuracao"
;<StructuredData
  localBusiness={DEFAULT_LOCAL_BUSINESS} // Pre-configured GB Locações data
  product={{
    // For product pages
    name: equipment.name,
    description: equipment.description,
    image: equipment.images,
    brand: "GB Locações",
    offers: {
      price: equipment.pricePerDay,
      priceCurrency: "BRL",
      availability: equipment.available ? "InStock" : "OutOfStock",
      url: `https://locacoesgb.com.br/equipamentos/${equipment.id}`
    }
  }}
  breadcrumbs={[
    // For breadcrumb schema
    { name: "Home", url: "https://locacoesgb.com.br" },
    { name: "Equipment", url: "https://locacoesgb.com.br/equipamentos" }
  ]}
/>
```

**Features:**

- LocalBusiness schema (pre-configured for GB Locações)
- Product schema for equipment
- BreadcrumbList schema
- Google-friendly JSON-LD format

### **SEO Features**

#### **Dynamic Metadata**

The live equipment route is
`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/equipamentos/[id]/page.tsx`.
It exports `generateMetadata`, awaits
`params: Promise<{ locadora: string; id: string }>` and reads equipment, site
and store data through the server API composition. `buildEquipmentSeo` is
exported by `@gb-locacoes/frontend/pages/equipamento-detalhe`; canonical, site
name, authorship and image URLs use the selected store. No fixed GB name or
domain may act as a fallback for another tenant. A site that is not indexable
keeps `noindex` in the route metadata.

#### **Dynamic Sitemap and Robots**

- Sitemap owner:
  `apps/clients/web/src/app/(public)/[locadora]/sitemap.xml/route.ts`.
- Robots owner:
  `apps/clients/web/src/app/(public)/[locadora]/robots.txt/route.ts`.
- Contract and tests:
  [seo-e-medicao-da-vitrine.md](../features/seo-e-medicao-da-vitrine.md), route
  tests and `(vitrine)/seo.test.ts`.

These routes use the tenant host and publication/indexing policy. The old root
`app/sitemap.ts` is retired; a shared static robots file is not the source of
tenant policy. Read the bundled Next.js file-convention and metadata guides
before changing these routes.

## 🎨 **Design System**

### **Colors** (Tailwind Classes)

```css
/* Primary Brand Colors */
text-orange-600     /* Primary text/icons */
bg-orange-600       /* Primary backgrounds */
border-orange-600   /* Primary borders */

/* Hover States */
hover:bg-orange-700
hover:text-orange-700

/* Light Variants */
bg-orange-50        /* Very light backgrounds */
text-orange-100     /* Light text on dark backgrounds */
border-orange-200   /* Subtle borders */

/* Status Colors */
text-green-600      /* Success states */
text-red-600        /* Error states */
text-yellow-600     /* Warning states */
```

### **Typography**

```css
/* Headings - Jost Font */
font-jost text-3xl font-bold     /* Main headings */
font-jost text-xl font-semibold  /* Subheadings */

/* Body - Inter Font */
font-inter text-base             /* Regular text */
font-inter text-sm text-gray-600 /* Secondary text */
```

### **Spacing & Layout**

```css
/* Standard spacing scale */
gap-4 p-4 m-4           /* 1rem */
gap-6 p-6 m-6           /* 1.5rem */
gap-8 p-8 m-8           /* 2rem */

/* Responsive patterns */
p-4 md:p-6 lg:p-8       /* Responsive padding */
text-sm md:text-base lg:text-lg  /* Responsive text */
grid-cols-1 md:grid-cols-2 lg:grid-cols-3  /* Responsive grid */
```

### **Animation Standards**

```tsx
// Framer Motion - Standard patterns
import { motion } from 'framer-motion'

// Page/Section entrance
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>

// Staggered list items
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.1, duration: 0.3 }}
>

// Hover effects
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
```

## 🛢️ **Database Patterns**

### **Server composition and tenant transactions**

`getDatabaseRuntime` is exported by `@gb-locacoes/backend/runtime`. The API
composition in `apps/services/api/src/host/runtime.ts` supplies the Prisma
dependency to backend factories. Private handlers resolve the session and tenant
principal; module queries use `withTenantTransaction` from
`@gb-locacoes/backend/identity`, which sets the transaction-local
`app.tenant_id`. Public catalogue queries also use an explicit tenant.

The former `@/lib/prisma` was retired in F. Use the tenant-scoped backend owner.
Do not query a global equipment list from a Server Component or infer
authorization from `ADMIN` alone. The web Server Component consumes
`apps/clients/web/src/host/server/public-api.ts`; Prisma and secrets remain on
the API/backend side.

Use the schemas in `packages/contracts` and pricing rules in `packages/domain`;
follow [quote-system.md](../features/quote-system.md) for monetary obligations.
Migrations are applied with `prisma migrate deploy`, never `db push`;
operational repair is a separate runbook action against a known owned target.

## 🎯 **Business Logic Patterns**

### **Pricing and freight**

Use the public `@gb-locacoes/domain/orcamento` contract, including
`buildQuotePricing`, `quoteItemsAndFreight`, `quoteObligation`,
`calculateFreight` and `calculateLateFee`. Their implementations are in
`packages/domain/src/orcamento`. Do not reintroduce the illustrative
floating-point discount formula formerly shown here.

### **Availability**

The authoritative rental availability service is `createRentalAvailability` from
`@gb-locacoes/backend/rentals`
(`packages/backend/src/modules/rentals/availability.ts`), composed by
`apps/services/api/src/host/rentals.ts`. Catalogue visibility is not a stock
reservation or an authorization decision.

### **Images and structured data**

The equipment entity exports `buildEquipmentImageUrl`, `buildEquipmentSeo` and
`buildEquipmentProductStructuredData` from
`packages/frontend/src/entities/equipamento/index.ts`. Hosts consume the page
entry point, while frontend slices respect FSD layer boundaries. Image and
canonical origins belong to the selected tenant; do not concatenate a fixed GB
production origin as a default.

## 📱 **API Patterns**

### **API Route Structure**

```typescript
// apps/services/api/src/app/api/equipments/route.ts (composição existente)
import { publicEquipments } from "../../../host/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0
export const GET = publicEquipments
```

This is the actual public route composition; `tenantSlug` is required.
Validation, private identity and permissions stay in the owning host and backend
modules. For a private write, examine
`apps/services/api/src/app/api/admin/settings/route.ts`: it resolves
`SETTINGS/WRITE`, checks mutation origin and validates `SettingsSchema` before
calling `host/branding`.

### **Client-side API Usage**

Use `useApiClient` or `useScopedApiClient` from the frontend `shared/api` public
entry point inside allowed FSD layers. The concrete transport is
`packages/frontend/src/shared/api/http-client.ts`; hosts configure its origin
and credentials. A scoped consumer invalidates work when tenant or session
changes. Do not invent `/api/equipamentos` endpoints or retain the old root
action imports from illustrative snippets.

## 🧪 **Testing Patterns**

### **Component Testing** (Vitest + Testing Library)

```tsx
// packages/ui/src/web/Button.web.test.tsx (teste colocado junto do componente)
import { render, screen } from "@testing-library/react"
import { Button } from "./Button.web"

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument()
  })
})
```

### **API Testing**

Real host tests live in `tests/api-host/*.http.test.ts` with setup in
`tests/api-host/global-setup.ts`. They exercise a real API host and an owned
PostgreSQL fixture; the retired root host is not a test dependency. Backend
factory tests and pure contract/domain tests remain independent of HTTP. Keep
literal fixture DTOs and negative tenant/permission cases; checking only “an
array was returned” does not characterize the contract.

```bash
pnpm test:unit
pnpm test:web
pnpm test:api   # Only with the disposable DB/build prerequisites configured
```

See [testing.md](../guides/testing.md) for coherent auth builds, ownership and
teardown. Browser journeys and visual acceptance remain separate proofs.

## 🚀 **Deployment & Production**

### **Build Process**

```bash
pnpm type-check
pnpm typecheck
pnpm lint
pnpm test:all
pnpm build
pnpm bundle:mobile
pnpm build-storybook
```

Build and packaging are local artifacts; these commands do not authorize deploy,
production migrations or provider calls. Start hosts separately with
`pnpm --filter @gb-locacoes/api start` and
`pnpm --filter @gb-locacoes/web start --port 3001` only against the intended
owned environment, and stop the processes you started.

### **Environment Variables**

Use os templates de cada host: `apps/services/api/.env.example`,
`apps/clients/web/.env.example` e `apps/clients/mobile/.env.example`. Os
arquivos privados não são versionados. Configure apenas o ambiente local deste
produto e um PostgreSQL próprio; nunca reutilize conexões, indicadores de deploy
ou credenciais da GB. Banco hospedado e provedores serão escolhidos em uma etapa
posterior. Mantenha as integrações desligadas conforme os templates; não execute
seed ou scripts operacionais como parte do setup.

### **Performance Monitoring**

- **Vercel Analytics**: Already integrated
- **Core Web Vitals**: Monitor LCP, FID, CLS
- **Error Tracking**: Console errors logged
- **User Feedback**: Toast notifications for actions

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Prisma "Did not initialize yet" error**

```bash
# Solution 1: Remove PRISMA_GENERATE_DATAPROXY from .env
# Solution 2: Regenerate the Prisma Client
pnpm db:generate
```

#### **Build failing with TypeScript errors**

```bash
# Check strict mode compliance
pnpm type-check

# Common fixes:
# - Add proper types to props
# - Use @ts-expect-error with description
# - Check import/export consistency
```

#### **Components not updating**

```bash
# Inspect the generated cache of the intended host before removing exact files.
# Never recursively traverse junctions/symlinks or delete node_modules by hand.
# Host caches are apps/clients/web/.next and apps/services/api/.next.
pnpm dev
```

See
[Limpeza segura](./troubleshooting.md#-limpeza-segura-nunca-apague-node_modules-à-mão)
(entry 171 of `docs/issues/known-issues.md`).

### **Performance Issues**

- Check image sizes and formats
- Verify lazy loading implementation
- Monitor bundle size with `pnpm perf:lighthouse` and the build output
- Use React DevTools Profiler

## 📚 **Additional Resources**

### **Project Documentation**

- `AGENTS.md` - Main project guidelines
- `docs/features/` - Feature-specific documentation
- `docs/architecture/` - Technical architecture
- `CHANGELOG.md` - Recent changes

### **External Resources**

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Tailwind CSS Classes](https://tailwindcss.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Framer Motion API](https://www.framer.com/motion/)
- [Radix UI Components](https://www.radix-ui.com/docs)

### **Tools & Extensions**

- **VS Code**: Recommended editor
- **Extensions**: Prisma, Tailwind CSS IntelliSense, ES7+
  React/Redux/React-Native snippets
- **Chrome DevTools**: React Developer Tools, Lighthouse

---

## 🎯 **Development Philosophy**

### **Core Principles**

1. **Reuse over recreate** - Always check existing components first
2. **Type safety first** - TypeScript strict mode, no `any` types
3. **Performance matters** - Optimize images, lazy load, measure Core Web Vitals
4. **Accessibility by default** - ARIA labels, semantic HTML, keyboard
   navigation
5. **SEO optimized** - Metadata, structured data, semantic markup

### **Code Review Checklist**

- [ ] TypeScript strict compliance
- [ ] Responsive design tested
- [ ] Accessibility features included
- [ ] SEO metadata added (if applicable)
- [ ] Error handling implemented
- [ ] Loading states included
- [ ] Analytics tracking added (if CTA)
- [ ] CHANGELOG.md updated

Welcome to the GB Locações development team! 🚀

---

_Original guide: January 2025. Current instructions describe the workspace after
local root retirement; clone validation is recorded separately._  
_For questions, check the documentation or reach out to the team_
