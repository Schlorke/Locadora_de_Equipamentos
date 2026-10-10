# ScrollArea

> **Status**: Standard **Last updated**: 2026-02-01

---

## 1. Purpose

Provide a consistent custom scrollbar wrapper (Radix ScrollArea) for internal
panels and lists, with optional horizontal scrolling.

## 2. Scope

**In scope**

- Base ScrollArea component styling and behavior
- Thumb/track sizing and hover-only visibility
- Vertical and optional horizontal scrollbars
- **Setas de rolagem** (igual à sidebar admin): triângulos laranja (#ea580c /
  hover #c2410c) nas extremidades, reutilizando o visual de `.admin-sidebar-nav`
  via classes `.scroll-area-arrow-*` em
  `packages/frontend/src/app/styles/scrollbars.web.css` (cores `--brand` e
  `--brand-hover`, sem duplicar o estilo no host).

**Out of scope**

- Page-specific layout and spacing decisions
- Native scrollbar styling outside Radix ScrollArea

## 3. Entry Points

- Routes: `/admin/email`, em
  `apps/clients/web/src/app/(admin)/admin/email/page.tsx` (via slice
  email-admin)
- Components: `packages/ui/src/web/ScrollArea.web.tsx`

## 4. Core Flow

1. Render `ScrollArea` root and viewport.
2. Always render vertical scrollbar (with up/down arrow buttons).
3. Render horizontal scrollbar only when `horizontal` is true (with left/right
   arrow buttons).
4. Radix computes thumb length; thickness is explicitly defined per orientation.
5. Arrow buttons scroll the viewport by a fixed step (40px) on click; styling
   matches sidebar scrollbar arrows in
   `packages/frontend/src/app/styles/scrollbars.web.css`.

## 5. Components and Files

- `packages/ui/src/web/ScrollArea.web.tsx`
- `packages/frontend/src/pages/email-admin/ui/email-viewer.web.tsx`
- `packages/frontend/src/pages/email-admin/ui/email-message-list.web.tsx`
- `packages/frontend/src/pages/email-admin/ui/email-folder-list.web.tsx`

## 6. Data and State

- Props: `horizontal`, `hoverOnly`, `scrollbarClassName`, `thumbClassName`,
  `arrowClassName`
- No external data sources or stores.

## 7. Constraints and Edge Cases

- Radix defines thumb size along the scroll axis only; thickness must be set
  explicitly to keep both orientations visually identical.
- Set thumb thickness via `style` (`width` for vertical, `height` for
  horizontal) because Radix uses inline styles that override Tailwind classes.
- The current `ScrollArea.web.tsx` sets `thumbThickness` to `6px` for both
  orientations, with `rounded-full` and orange hover colors. The earlier 8px
  instruction does not describe this source; this documentation change does not
  change the component or approve a visual difference.
- Avoid changing surrounding layout or spacing without explicit request.

## 8. Error Handling

- N/A (presentational component).

## 9. Performance and Accessibility

- Uses Radix ScrollArea for accessible scrollbars.
- Keep component light; no extra effects or data fetching.

## 10. Tests and Validation

- Manual:
  1. Open `/admin/email` with a message that forces horizontal overflow.
  2. Confirm vertical and horizontal scrollbars have the same thickness.
  3. Verify message list and folder list still render expected scrollbars.

## 11. Related Docs

- `docs/issues/scroll-area-thumb-thickness-spec.md`
- `docs/features/admin-email-ui-ux.md`
- `docs/features/design-system.md`

## 12. Change Log

- 2026-02-01: Setas de rolagem (igual à sidebar) em vertical e horizontal;
  classes reutilizáveis no arquivo antigo `app/globals.css`
  (`.scroll-area-arrow-*`, retirado em F); context do viewport para scroll
  programático. Hoje essas regras pertencem a `scrollbars.web.css` do frontend.
- 2026-02-01: Explicit thumb thickness per orientation with fixed sizing.

---

_Template version: 2026-01-20_
