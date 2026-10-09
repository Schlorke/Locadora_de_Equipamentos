import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface NavigationMenuProps {
  children?: ReactNode;
}

export interface NavigationMenuListProps {
  children?: ReactNode;
}

export interface NavigationMenuItemProps {
  children?: ReactNode;
}

export interface NavigationMenuTriggerProps {
  children?: ReactNode;
}

export interface NavigationMenuContentProps {
  children?: ReactNode;
}

export interface NavigationMenuLinkProps {
  children?: ReactNode;
  href?: string;
  onPress?: () => void;
}

export interface NavigationMenuViewportProps {
  children?: ReactNode;
}

export interface NavigationMenuIndicatorProps {
  children?: ReactNode;
}
