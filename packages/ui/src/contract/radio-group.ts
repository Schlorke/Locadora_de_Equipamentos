import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export interface RadioGroupItemProps {
  value: string;
  disabled?: boolean;
  children?: ReactNode;
}
