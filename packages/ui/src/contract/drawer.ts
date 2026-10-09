import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do vaul. */
export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  shouldScaleBackground?: boolean;
  children?: ReactNode;
}

export interface DrawerTriggerProps {
  children?: ReactNode;
}

export interface DrawerCloseProps {
  children?: ReactNode;
}

export interface DrawerContentProps {
  children?: ReactNode;
}

export interface DrawerHeaderProps {
  children?: ReactNode;
}

export interface DrawerFooterProps {
  children?: ReactNode;
}

export interface DrawerTitleProps {
  children?: ReactNode;
}

export interface DrawerDescriptionProps {
  children?: ReactNode;
}
