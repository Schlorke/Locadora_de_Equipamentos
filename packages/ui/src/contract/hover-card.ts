import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface HoverCardProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  openDelay?: number;
  closeDelay?: number;
  children?: ReactNode;
}

export interface HoverCardTriggerProps {
  children?: ReactNode;
}

export interface HoverCardContentProps {
  children?: ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}
