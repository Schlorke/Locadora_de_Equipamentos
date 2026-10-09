import type { ReactNode } from "react";
import { border, radius, space, typography, type ThemeColors } from "@gb-locacoes/design-tokens";

export const ctaVariantNames = ["primary", "secondary", "outline", "ghost"] as const;
export type CTAVariant = (typeof ctaVariantNames)[number];

export const ctaSizeNames = ["sm", "md", "lg"] as const;
export type CTASize = (typeof ctaSizeNames)[number];

/** Contrato compartilhado do CTA. Web aceita className/href/ícones; nativo usa este recorte + tokens. */
export interface CTAButtonProps {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  href?: string;
  variant?: CTAVariant;
  size?: CTASize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  trackingId?: string;
  fullWidth?: boolean;
  animate?: boolean;
  testID?: string;
}

export interface CTAButtonStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  paddingVertical: number;
  paddingHorizontal: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: typeof typography.weight.regular | typeof typography.weight.semibold;
}

const sizePadding: Record<
  CTASize,
  {
    paddingVertical: number;
    paddingHorizontal: number;
    fontSize: number;
    fontWeight: typeof typography.weight.regular | typeof typography.weight.semibold;
  }
> = {
  sm: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
  },
  md: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    fontSize: typography.size.md,
    fontWeight: typography.weight.regular,
  },
  lg: {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
};

/** Estilo nativo derivado dos tokens. Classes Tailwind do web permanecem as da produção (orange-600 = #ea580c). */
export function resolveCTAButtonStyle(
  theme: ThemeColors,
  variant: CTAVariant,
  size: CTASize,
  state: { disabled?: boolean },
): CTAButtonStyle {
  const filled = variant === "primary" || variant === "secondary";
  const backgroundColor =
    variant === "primary" ? theme.primary : variant === "secondary" ? theme.secondary : "transparent";
  const color = filled ? (variant === "primary" ? theme.onPrimary : theme.onSecondary) : theme.primary;
  const borderColor = variant === "outline" ? theme.primary : backgroundColor;
  const sizing = sizePadding[size];
  return {
    backgroundColor,
    color,
    borderColor,
    borderWidth: variant === "outline" ? border.hairline : border.none,
    opacity: state.disabled ? 0.6 : 1,
    paddingVertical: sizing.paddingVertical,
    paddingHorizontal: sizing.paddingHorizontal,
    borderRadius: radius.sm,
    fontSize: sizing.fontSize,
    fontWeight: sizing.fontWeight,
  };
}
