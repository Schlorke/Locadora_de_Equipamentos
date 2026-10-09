import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export type AccordionType = "single" | "multiple";

export interface AccordionProps {
  type?: AccordionType;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
  children?: ReactNode;
}

export interface AccordionItemProps {
  disabled?: boolean;
  value: string;
  children?: ReactNode;
}

export interface AccordionTriggerProps {
  children?: ReactNode;
}

export interface AccordionContentProps {
  children?: ReactNode;
}
