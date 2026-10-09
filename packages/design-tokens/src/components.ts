// Nível 3 do design system: tokens de componente, só dados. Cada medida vem das classes do
// componente web aprovado (packages/ui/src/contract/button.ts, web/Badge.web.tsx,
// web/Input.web.tsx, web/Card.web.tsx, web/field.ts e os tokens de campo do tokens.css) e
// aponta para um primitivo; cada cor aponta para um papel semântico. Nenhum consumidor usa
// este nível ainda: os componentes nativos continuam em `componentTokens` (tokens.ts).
//
// As classes de paleta do web (bg-slate-700, border-gray-200...) renderizam a paleta da
// produção (Tailwind 3.4.17, primitives.tailwind, declarada em palette.css); aqui a cor é o
// papel semântico em hex das fontes do projeto (ex.: action.secondary = #334155, o slate-700).
import { primitives } from "./primitives";
import type { SemanticTheme } from "./semantic";

const { space, radius, borderWidth, typography, tailwindShadow, opacity, scale, motion, letterSpacing } = primitives;
const { size, sizeLineHeight, weight, leading } = typography;

export function componentSpecs(theme: SemanticTheme) {
  return {
    /** buttonVariants: rounded-md font-medium gap-2 [&_svg]:size-4 duration-200. */
    button: {
      radius: radius.md,
      gap: space["2"],
      iconSize: space["4"],
      fontWeight: weight.medium,
      disabledOpacity: opacity["50"],
      hoverScale: scale["105"],
      transitionMs: motion.duration.fast,
      shadow: tailwindShadow.md,
      hoverShadow: tailwindShadow.lg,
      size: {
        /** h-8 px-3 text-xs; a partir de 640px: h-9 px-4 text-sm. */
        compact: {
          height: space["8"],
          paddingX: space["3"],
          fontSize: size.xs,
          lineHeight: sizeLineHeight.xs,
          sm: { height: space["9"], paddingX: space["4"], fontSize: size.sm, lineHeight: sizeLineHeight.sm },
        },
        /** h-10 px-4 py-2 text-sm */
        default: { height: space["10"], paddingX: space["4"], paddingY: space["2"], fontSize: size.sm, lineHeight: sizeLineHeight.sm },
        /** h-10 px-4 text-sm */
        sm: { height: space["10"], paddingX: space["4"], fontSize: size.sm, lineHeight: sizeLineHeight.sm },
        /** h-12 px-8 text-base */
        lg: { height: space["12"], paddingX: space["8"], fontSize: size.base, lineHeight: sizeLineHeight.base },
        /** h-10 w-10 */
        icon: { height: space["10"], width: space["10"] },
      },
      variant: {
        /** bg-slate-700 text-white border border-slate-700 */
        default: {
          background: theme.action.secondary,
          color: theme.action.onSecondary,
          border: theme.action.secondary,
          borderWidth: borderWidth["1"],
        },
        /** bg-destructive text-destructive-foreground hover:text-orange-500 */
        destructive: {
          background: theme.feedback.danger,
          color: theme.feedback.onDanger,
          border: null,
          borderWidth: borderWidth["0"],
          hoverColor: theme.brand.vivid,
        },
        /** border border-gray-200 bg-background hover:text-orange-600 */
        outline: {
          background: theme.surface.default,
          color: theme.text.default,
          border: theme.border.subtle,
          borderWidth: borderWidth["1"],
          hoverColor: theme.brand.default,
        },
        /** bg-secondary text-secondary-foreground hover:bg-secondary/80 */
        secondary: {
          background: theme.action.subtle,
          color: theme.action.onSubtle,
          border: null,
          borderWidth: borderWidth["0"],
          hoverBackgroundOpacity: opacity["80"],
        },
        /** border border-transparent hover:text-orange-600 */
        ghost: {
          background: null,
          color: theme.text.default,
          border: null,
          borderWidth: borderWidth["1"],
          hoverColor: theme.brand.default,
        },
        /** text-primary underline-offset-4 hover:underline */
        link: {
          background: null,
          color: theme.surface.inverse,
          border: null,
          borderWidth: borderWidth["0"],
          underlineOffset: space["1"],
        },
      },
    },
    /** badgeVariants: rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight. */
    badge: {
      radius: radius.full,
      paddingX: space["2.5"],
      paddingY: space["0.5"],
      fontSize: size.xs,
      fontWeight: weight.semibold,
      lineHeight: leading.tight,
      hoverBackgroundOpacity: opacity["80"],
      variant: {
        /** bg-primary text-primary-foreground */
        default: { background: theme.surface.inverse, color: theme.text.onInverse },
        /** bg-secondary text-secondary-foreground */
        secondary: { background: theme.action.subtle, color: theme.action.onSubtle },
        /** bg-destructive text-destructive-foreground */
        destructive: { background: theme.feedback.danger, color: theme.feedback.onDanger },
        /** text-foreground */
        outline: { background: null, color: theme.text.default },
      },
    },
    /**
     * Input: h-10 rounded-md border px-3 py-2 text-base md:text-sm disabled:opacity-50.
     * A moldura dos campos (FIELD_FRAME em packages/ui/src/web/field.ts) põe a borda cinza 200,
     * shadow-control (shadow-md), hover shadow-control-hover (shadow-lg) e, no foco, borda azul
     * com o halo de 3px de --shadow-control-focus (tokens.css).
     */
    input: {
      height: space["10"],
      radius: radius.md,
      borderWidth: borderWidth["1"],
      paddingX: space["3"],
      paddingY: space["2"],
      fontSize: size.base,
      fontSizeMd: size.sm,
      background: theme.surface.default,
      border: theme.border.subtle,
      color: theme.text.strong,
      placeholder: theme.text.muted,
      disabledOpacity: opacity["50"],
      transitionMs: motion.duration.fast,
      shadow: tailwindShadow.md,
      hoverShadow: tailwindShadow.lg,
      focus: {
        border: theme.focus.border,
        outlineWidth: borderWidth["2"],
        haloColor: theme.focus.halo,
        haloWidth: borderWidth["3"],
      },
    },
    /** Card: rounded-lg border bg-card text-card-foreground shadow-sm; seções p-6. */
    card: {
      radius: radius.lg,
      borderWidth: borderWidth["1"],
      border: theme.border.default,
      background: theme.surface.raised,
      color: theme.text.default,
      shadow: tailwindShadow.sm,
      padding: space["6"],
      headerGap: space["1.5"],
      /** text-2xl font-semibold leading-none tracking-tight */
      title: {
        fontSize: size["2xl"],
        fontWeight: weight.semibold,
        lineHeight: leading.none,
        letterSpacing: letterSpacing.tight,
      },
      /** text-sm text-muted-foreground */
      description: { fontSize: size.sm, lineHeight: sizeLineHeight.sm, color: theme.text.muted },
    },
  } as const;
}

export type ComponentSpecs = ReturnType<typeof componentSpecs>;
