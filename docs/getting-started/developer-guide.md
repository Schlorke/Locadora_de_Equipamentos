# 👨‍💻 Developer Guide - GB Locações

> **Target**: Human Developers (Frontend, Backend, Full-Stack)  
> **Project**: GB Locações Equipment Rental Platform  
> **Updated**: January 2025

## 🎯 **Quick Start for New Developers**

### **Prerequisites**

- Node.js 18+
- npm (not pnpm - causes Prisma conflicts)
- PostgreSQL database
- Git

### **Setup**

```bash
# Clone and install
git clone [repository-url]
cd GB-Locacoes
pnpm install

# Environment setup
cp .env.example .env
# Edit .env with your database credentials

# Database setup
pnpm db:generate
pnpm exec prisma migrate deploy  # migrations with RLS; never db push

# Start development
pnpm dev
```

### **Essential Commands**

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm type-check   # Check TypeScript
pnpm lint         # Check ESLint
pnpm db:studio    # Open Prisma Studio
pnpm storybook    # View component library
```

## 🧩 **Component Library Overview**

### **New Components (January 2025)**

> Os caminhos abaixo foram atualizados para a estrutura atual (packages/ui e as
> fatias de packages/frontend); o inventário vivo é
> [COMPONENT_INVENTORY.md](../COMPONENT_INVENTORY.md).

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

#### **Dynamic Metadata** - Automatic SEO optimization

```tsx
// Location: app/equipamentos/[id]/page.tsx (pattern)
// Usage: All pages should have generateMetadata

export async function generateMetadata({ params }): Promise<Metadata> {
  // Fetch data based on params
  const data = await fetchPageData(params)

  return {
    title: `${data.name} | GB Locações`,
    description: `${data.description} Solicite seu orçamento em Porto Alegre!`,
    keywords: [
      `aluguel ${data.name.toLowerCase()}`,
      "equipamentos construção civil",
      "gb locações"
    ],
    alternates: {
      canonical: `https://locacoesgb.com.br${pathname}`
    },
    openGraph: {
      title: data.name,
      description: data.description,
      url: `https://locacoesgb.com.br${pathname}`,
      siteName: "GB Locações",
      images: [
        {
          url: data.image,
          width: 1200,
          height: 630,
          alt: `${data.name} - GB Locações`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: data.name,
      description: data.description,
      images: [data.image]
    }
  }
}
```

#### **Dynamic Sitemap** - Automatic URL generation

```tsx
// Location: app/sitemap.ts
// Auto-generated - includes all equipment and category URLs
// Accessible at: /sitemap.xml
```

#### **Optimized Robots.txt** - Search engine guidance

```
# Location: public/robots.txt
# Pre-configured for optimal crawling
# Blocks admin areas, allows equipment pages
```

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

### **Prisma Usage**

```tsx
// Server components only (app router)
async function getPrisma() {
  const { prisma } = await import("@/lib/prisma")
  return prisma
}

// Query patterns
const equipment = await prisma.equipment.findUnique({
  where: { id: params.id },
  include: {
    category: {
      select: {
        name: true,
        slug: true,
        icon: true
      }
    }
  }
})

// Handle Prisma Decimal types
const price = Number(equipment.pricePerDay)
```

### **Common Queries**

```tsx
// Get available equipment with category
const availableEquipment = await prisma.equipment.findMany({
  where: { available: true },
  include: { category: true },
  orderBy: { name: "asc" }
})

// Get equipment by category
const equipmentByCategory = await prisma.equipment.findMany({
  where: {
    categoryId: categoryId,
    available: true
  },
  include: { category: true }
})

// Search equipment
const searchResults = await prisma.equipment.findMany({
  where: {
    AND: [
      { available: true },
      {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } }
        ]
      }
    ]
  },
  take: 10
})
```

## 🎯 **Business Logic Patterns**

### **Pricing Calculations**

```tsx
// Standard pricing logic
export const calculateRentalPrice = (
  basePrice: number,
  days: number,
  discounts?: {
    weekly?: number
    monthly?: number
  }
) => {
  const weeklyDiscount = discounts?.weekly || 0.9
  const monthlyDiscount = discounts?.monthly || 0.8

  if (days >= 30) {
    return basePrice * days * monthlyDiscount
  }
  if (days >= 7) {
    return basePrice * days * weeklyDiscount
  }
  return basePrice * days
}

// Usage
const totalPrice = calculateRentalPrice(
  Number(equipment.pricePerDay),
  rentalDays,
  { weekly: 0.9, monthly: 0.75 }
)
```

### **Availability Checks**

```tsx
// Handle different availability field names
const isEquipmentAvailable = (equipment: Equipment) => {
  return equipment.available ?? equipment.isAvailable ?? true
}

// Check availability with stock
const checkAvailability = (equipment: Equipment, requestedQuantity: number) => {
  if (!isEquipmentAvailable(equipment)) return false
  if (equipment.maxStock && requestedQuantity > equipment.maxStock) return false
  return true
}
```

### **Image Handling**

```tsx
// Standard image URL processing
export const getImageUrl = (
  imageUrl?: string,
  fallback = "/placeholder.jpg"
) => {
  if (!imageUrl) return fallback

  // If already full URL, return as-is
  if (imageUrl.startsWith("http")) return imageUrl

  // If relative URL, make absolute
  return `https://locacoesgb.com.br${imageUrl}`
}

// Get primary image from equipment
export const getPrimaryImage = (equipment: Equipment) => {
  const primaryImage = equipment.images?.[0] || equipment.imageUrl
  return getImageUrl(primaryImage)
}
```

## 📱 **API Patterns**

### **API Route Structure**

```tsx
// app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Request validation schema
const RequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = RequestSchema.parse(body)

    // Business logic
    const result = await processData(validatedData)

    // Success response
    return NextResponse.json({
      success: true,
      data: result,
      message: "Operação realizada com sucesso"
    })
  } catch (error) {
    console.error("API Error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno do servidor"
      },
      { status: 500 }
    )
  }
}
```

### **Client-side API Usage**

```tsx
// Using SWR for data fetching (recommended)
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export const useEquipmentData = (id: string) => {
  const { data, error, isLoading } = useSWR(`/api/equipamentos/${id}`, fetcher)

  return {
    equipment: data?.data,
    loading: isLoading,
    error: error || (data && !data.success)
  }
}

// Form submission pattern
const submitQuote = async (formData: QuoteFormData) => {
  try {
    const response = await fetch("/api/orcamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    })

    const result = await response.json()

    if (result.success) {
      toast({ title: "Sucesso!", description: result.message })
      return result.data
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    toast({
      title: "Erro",
      description: "Erro ao enviar orçamento. Tente novamente.",
      variant: "destructive"
    })
    throw error
  }
}
```

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

```tsx
// exemplo: tests/api/<rota>.test.ts
import { testApiHandler } from "next-test-api-route-handler"
import * as appHandler from "@/app/api/equipamentos/route"

describe("/api/equipamentos", () => {
  it("returns equipment list", async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: "GET" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        expect(Array.isArray(data.data)).toBe(true)
      }
    })
  })
})
```

## 🚀 **Deployment & Production**

### **Build Process**

```bash
# Pre-build checks
pnpm type-check    # TypeScript validation
pnpm lint         # ESLint checks
npm test             # Run tests

# Build
pnpm build        # Production build
npm start            # Start production server
```

### **Environment Variables**

```bash
# .env.local (production)
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="https://locacoesgb.com.br"
RESEND_API_KEY="your-resend-key"
VERCEL_ANALYTICS_ID="your-analytics-id"
```

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
# Next.js cache: delete the generated .next folder only after checking it has
# no link (find .next -type l prints nothing); never delete node_modules by hand
find .next -type l
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

_Last updated: January 2025_  
_For questions, check the documentation or reach out to the team_
