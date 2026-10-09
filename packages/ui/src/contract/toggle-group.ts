import type { ReactNode } from "react";
import type { ToggleSize, ToggleVariant } from "./toggle";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface ToggleGroupProps {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  disabled?: boolean;
  children?: ReactNode;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

export interface ToggleGroupItemProps {
  value: string;
  disabled?: boolean;
  children?: ReactNode;
  variant?: ToggleVariant;
  size?: ToggleSize;
}
