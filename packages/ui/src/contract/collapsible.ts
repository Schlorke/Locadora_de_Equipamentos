import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface CollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export interface CollapsibleTriggerProps {
  children?: ReactNode;
  disabled?: boolean;
}

export interface CollapsibleContentProps {
  children?: ReactNode;
}
