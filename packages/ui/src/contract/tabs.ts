import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

export interface TabsListProps {
  children?: ReactNode;
}

export interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  children?: ReactNode;
}

export interface TabsContentProps {
  value: string;
  children?: ReactNode;
}
