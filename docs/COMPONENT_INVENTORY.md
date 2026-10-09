# 📦 Component Inventory - GB Locações

> **⚠️ READ THIS FIRST** before creating any component. **Purpose**: prevent
> component duplication and ensure reuse. The old inventory (January 2025)
> pointed to `components/`, a folder that no longer exists; the paths below are
> the current ones.

## 🛡️ Anti-duplication checklist

Before creating ANY component, ask:

1. Does this functionality already exist in `@gb-locacoes/ui` or in a
   `packages/frontend` slice?
2. Can I extend an existing component (a new variant in its contract)?
3. Is there a pre-configured variant available?

## 📋 Where components live

| Need                         | Where to look                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Design-system primitive      | `packages/ui/src/catalog.ts` (families, members and states), imported from `@gb-locacoes/ui`                                   |
| Variants of a primitive      | `packages/ui/src/contract/<name>.ts` (e.g. `button.ts`, `cta-button.ts`), shared by web and native                             |
| Web / native implementation  | `packages/ui/src/web/<Name>.web.tsx` and `packages/ui/src/native/<Name>.native.tsx`                                            |
| Buttons / CTAs               | `CTAButton`, `QuoteCTA`, `ContactCTA`, `WhatsAppCTA` from `@gb-locacoes/ui` (`packages/ui/src/web/CTAButton.web.tsx`)          |
| Quote form                   | `QuoteForm` from the `orcamento` page slice (`packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx`)                     |
| Equipment breadcrumb         | `packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoTrilha.web.tsx` (internal to the detail page)                   |
| SEO structured data          | `StructuredData` from `packages/frontend/src/widgets/dados-estruturados` and `SEOSchemas` from `widgets/seo-schemas`           |
| Product feature, page, block | The owning slice in `packages/frontend/src/{pages,widgets,features,entities}` (Feature-Sliced Design, imported via `index.ts`) |

### Current platform boundaries

- Price block: `features/bloco-preco/ui/Bloco.{web,native}.tsx`; props, and
  variants in `ui/contract.ts`, through the feature public API.
- Equipment detail:
  `pages/equipamento-detalhe/ui/EquipamentoDetalhePage.{web,native}.tsx`,
  `EquipamentoPeriodo.{web,native}.tsx` and `EquipamentoPreco.{web,native}.tsx`.
- Calendar: `widgets/calendario/ui/index.web.tsx` and
  `AdvancedCalendar.native.tsx`; shared event/resource/view types in
  `ui/types.ts`.
- Email: `pages/email-admin/ui/EmailAdminPage.{web,native}.tsx`; browser
  layout/viewer/composer/message list use `.web.tsx`. Hosts import the page
  entry point.
- Dashboard: `pages/dashboard/model/contratos.ts` for universal DTOs/initials;
  `tipos.web.ts` for web icons/cards/actions.
- Rentals: `pages/locacoes/model/contratos.ts` for shared contracts,
  `tipos.web.ts` for web status configuration and `ui/formatar.web.tsx` for
  badges.
- JSON-LD: `widgets/dados-estruturados/ui/StructuredData.web.tsx` and
  `widgets/seo-schemas/ui/SEOSchemas.web.tsx`; StructuredData native renders no
  DOM.
- CSS class merging: `shared/lib/cn.web.ts` is browser presentation; it is
  absent from the native API. The DOM test double
  `pages/catalog/ui/__tests__/native-test-host.tsx` is a fixture used by Vitest,
  outside product runtime.

All paths in this subsection are relative to `packages/frontend/src`. Use the
owning slice public API; file locations are inventory pointers, not deep-import
permissions for hosts or other slices.

## 🚫 Do not create

- A new button, dialog, input or card primitive: extend the contract in
  `packages/ui/src/contract/` and its `.web`/`.native` implementations.
- A new quote form: use `QuoteForm`.
- A new Schema.org implementation: use `StructuredData` / `SEOSchemas`.
- A component outside the FSD slices or `packages/ui` (the `components/` folder
  at the root is retired; `pnpm arch` rejects new unclassified roots).

## 📚 References

- `AGENTS.md` - Main project guidelines and anti-hallucination protocol
- `docs/features/design-system.md` - Tokens, CSS architecture and components
- `docs/ai/boot.md` and `docs/ai/context-map.md` - Reading order for AI agents
- `docs/getting-started/developer-guide.md` - Development guide

> **REUSE > RECREATE**: check the catalog and the slices before building
> anything new.
