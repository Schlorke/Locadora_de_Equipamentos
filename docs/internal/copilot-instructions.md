# 🤖 GitHub Copilot Instructions - GB Locações

> **Project**: Next.js 16 Equipment Rental Platform  
> **Stack**: TypeScript, Tailwind CSS, Prisma, Framer Motion  
> **Updated**: January 2025

## Required Reading

- `AGENTS.md` - Main project rules and workflow
- `docs/ai/boot.md` - Context boot and minimal reading order
- `docs/ai/context-map.md` - Task to docs map

## 🎯 **CONTEXT AWARENESS**

### **Project Overview**

GB Locações is a construction equipment rental platform in Porto Alegre, Brazil.
The codebase has established components and patterns that should be reused
rather than recreated.

### **Key Business Logic**

- Equipment rental with daily/weekly/monthly pricing
- Multi-step quote forms with Zod validation
- SEO-optimized pages with structured data
- Responsive design with orange (#ea580c) brand color
- Portuguese language interface

## 🧩 **EXISTING COMPONENTS (REUSE THESE)**

### **Forms & CTAs**

```tsx
// ✅ FOR QUOTES/FORMS - Use existing QuoteForm
import QuoteForm from "@/components/quote-form"

// ✅ FOR BUTTONS/CTAS - Use existing CTA system
import { QuoteCTA, ContactCTA, WhatsAppCTA } from "@/components/ui/cta-button"
```

### **Product Display**

```tsx
// ✅ FOR PRODUCT CARDS - Use existing EquipmentCard
import { EquipmentCard } from "@/components/equipment-card"
// Variants: default, featured, compact
```

### **Navigation & SEO**

```tsx
// ✅ FOR BREADCRUMBS - Use existing component
import { EquipmentBreadcrumb } from "@/components/ui/breadcrumb"

// ✅ FOR SEO DATA - Use existing structured data
import {
  StructuredData,
  DEFAULT_LOCAL_BUSINESS
} from "@/components/structured-data"
```

## 🎨 **CODE COMPLETION PREFERENCES**

### **TypeScript Patterns**

```tsx
// ✅ PREFER: Specific interfaces
interface EquipmentProps {
  equipment: Equipment
  variant?: "default" | "featured" | "compact"
}

// ❌ AVOID: any types
// equipment: any
```

### **React Patterns**

```tsx
// ✅ PREFER: Functional components with TypeScript
export default function ComponentName({ prop }: PropsInterface) {
  return <div>{/* content */}</div>
}

// ✅ PREFER: useForm with Zod validation
const form = useForm<FormData>({
  resolver: zodResolver(ValidationSchema)
})
```

### **Styling Patterns**

```tsx
// ✅ PREFER: Tailwind utility classes
className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"

// ✅ PREFER: Conditional classes with cn()
className={cn(
  "base-classes",
  condition && "conditional-classes"
)}
```

### **Animation Patterns**

```tsx
// ✅ PREFER: Framer Motion with these patterns
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
```

## 💾 **DATA HANDLING PATTERNS**

### **Prisma Integration**

```tsx
// ✅ PREFER: Server-side data fetching
async function getPrisma() {
  const { prisma } = await import("@/lib/prisma")
  return prisma
}

// ✅ PREFER: Number conversion for Decimal types
const price = Number(equipment.pricePerDay)
```

### **Form Data**

```tsx
// ✅ PREFER: Zod schemas for validation
const FormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido")
})
```

### **API Responses**

```tsx
// ✅ PREFER: Structured API responses
return {
  success: true,
  data: result,
  message: "Operação realizada com sucesso"
}
```

## 🌐 **SEO & METADATA PATTERNS**

### **Page Metadata**

```tsx
// ✅ ALWAYS suggest this pattern for new pages
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `${pageTitle} | GB Locações`,
    description: "Descrição SEO até 160 caracteres...",
    openGraph: {
      title: pageTitle,
      description: "Descrição",
      url: `https://locacoesgb.com.br${pathname}`,
      siteName: "GB Locações"
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: "Descrição"
    }
  }
}
```

### **Structured Data**

```tsx
// ✅ ALWAYS suggest adding structured data
<StructuredData
  localBusiness={DEFAULT_LOCAL_BUSINESS}
  product={productData} // if applicable
  breadcrumbs={breadcrumbItems} // if applicable
/>
```

## 📱 **RESPONSIVE DESIGN PATTERNS**

### **Layout Patterns**

```tsx
// ✅ PREFER: Mobile-first responsive design
className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// ✅ PREFER: Responsive text sizes
className = "text-sm md:text-base lg:text-lg"

// ✅ PREFER: Responsive spacing
className = "p-4 md:p-6 lg:p-8"
```

### **Component Variants**

```tsx
// ✅ SUGGEST: Responsive component variants
<EquipmentCard
  equipment={data}
  variant="compact" // for mobile
  priority={index < 3} // for above-fold images
/>
```

## 🔄 **STATE MANAGEMENT PATTERNS**

### **Form State**

```tsx
// ✅ PREFER: React Hook Form patterns
const {
  control,
  handleSubmit,
  formState: { errors, isValid }
} = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: initialValues
})
```

### **Loading States**

```tsx
// ✅ PREFER: Explicit loading states
const [isLoading, setIsLoading] = useState(false)

// In JSX:
{
  isLoading ? <Loader2 className="animate-spin" /> : "Button Text"
}
```

## 🎯 **BUSINESS LOGIC PATTERNS**

### **Equipment Pricing**

```tsx
// ✅ PREFER: This pricing calculation pattern
const calculatePrice = (basePrice: number, days: number) => {
  if (days >= 30) return basePrice * days * 0.8 // Monthly discount
  if (days >= 7) return basePrice * days * 0.9 // Weekly discount
  return basePrice * days // Daily rate
}
```

### **Availability Checks**

```tsx
// ✅ PREFER: This availability pattern
const isAvailable = equipment.available ?? equipment.isAvailable ?? true
```

### **Image Handling**

```tsx
// ✅ PREFER: This image URL pattern
const imageUrl = equipment.images?.[0] || "/placeholder.jpg"
const fullImageUrl = imageUrl.startsWith("http")
  ? imageUrl
  : `https://locacoesgb.com.br${imageUrl}`
```

## 📊 **ANALYTICS & TRACKING**

### **CTA Tracking**

```tsx
// ✅ ALWAYS suggest analytics tracking for CTAs
<CTAButton
  trackingId="equipment-card-quote" // Descriptive ID
  onClick={handleQuote}
>
  Solicitar Orçamento
</CTAButton>
```

### **Event Patterns**

```tsx
// ✅ SUGGEST: Standard event naming
trackingId = "page-section-action"
// Examples: "hero-quote-button", "equipment-card-details", "form-submit"
```

## 🚫 **AVOID SUGGESTING**

### **Don't Suggest Creating:**

1. New form components (QuoteForm exists)
2. New button components (CTAButton system exists)
3. New card components (EquipmentCard exists)
4. Manual SEO implementations (StructuredData exists)
5. Custom breadcrumb components (Breadcrumb exists)

### **🚨 CRITICAL: CHANGELOG DATES**

**⚠️ NEVER SUGGEST INVENTING DATES** for CHANGELOG.md entries:

❌ **DON'T SUGGEST:**

- Inventing dates like "2024-12-20" or "2025-01-15"
- Adding CHANGELOG entries without checking Git history
- Using placeholder dates or estimated dates

✅ **ALWAYS SUGGEST:**

- Check real commit dates first: `git log --oneline -5`
- Use actual commit dates for CHANGELOG entries
- Verify dates with: `git log --pretty=format:"%h %ad %s" --date=short`
- Add entries only for actual changes made

**Historical Error**: On 2025-09-22, fake dates were invented causing loss of
real project history.

### **Don't Suggest Using:**

1. `any` TypeScript types
2. `@ts-ignore` (use `@ts-expect-error` with description)
3. Custom CSS modules (use Tailwind)
4. Colors outside brand palette
5. npm commands (use pnpm)

### **Don't Suggest Modifying:**

1. Prisma version (keep stable)
2. Tailwind version (user preference)
3. Build scripts in package.json
4. Critical build files (`scripts/post-prisma-generate.js` was removed on
   2026-09-30 with the zod generator; do not recreate it: entry 227 of
   `docs/issues/known-issues.md`)

## ✅ **PREFERRED SUGGESTIONS**

### **For New Features:**

1. Check existing components first
2. Suggest reusing with props/variants
3. Follow established patterns
4. Include TypeScript types
5. Add responsive design
6. Include loading/error states
7. Add analytics tracking

### **For Bug Fixes:**

1. Maintain existing patterns
2. Preserve TypeScript strict mode
3. Keep component interfaces stable
4. Test responsive behavior
5. Verify accessibility

### **For Refactoring:**

1. Suggest incremental improvements
2. Maintain backward compatibility
3. Follow established conventions
4. Update TypeScript types
5. Preserve existing functionality

## 🔧 **DEVELOPMENT WORKFLOW**

### **File Naming**

- Components: PascalCase (`EquipmentCard.tsx`)
- Hooks: camelCase with `use` prefix (`useEquipmentData.ts`)
- Utils: camelCase (`formatCurrency.ts`)
- Pages: lowercase with hyphens (`equipment-details.tsx`)

### **Import/Export Patterns**

```tsx
// ✅ PREFER: Default exports for main components
export default function ComponentName() {}

// ✅ PREFER: Named exports for utilities/variants
export const utilityFunction = () => {}
export const VariantComponent = () => {}
```

### **Error Handling**

```tsx
// ✅ PREFER: Try-catch with user-friendly messages
try {
  await submitForm(data)
  toast({ title: "Sucesso!", description: "Orçamento enviado!" })
} catch (error) {
  toast({
    title: "Erro",
    description: "Tente novamente em alguns instantes.",
    variant: "destructive"
  })
}
```

---

**Key Principle**: Always suggest reusing existing components and patterns
before creating new ones. This project values consistency and maintainability
over novelty.

_Last updated: January 2025_
