import type { ReactNode } from "react";

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "default" | "sm" | "lg";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface ToggleProps {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  variant?: ToggleVariant;
  size?: ToggleSize;
}
