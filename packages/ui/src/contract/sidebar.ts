import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita a API completa do sidebar. */
export interface SidebarProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
  children?: ReactNode;
  className?: string;
}

export interface SidebarProps {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  children?: ReactNode;
  className?: string;
}

export interface SidebarTriggerProps {
  children?: ReactNode;
  className?: string;
  onClick?: (...args: unknown[]) => void;
}

export interface SidebarRailProps {
  className?: string;
}

export interface SidebarInsetProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarInputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (value:string) => void;
  className?: string;
}

export interface SidebarHeaderProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarFooterProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarContentProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarGroupProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarGroupLabelProps {
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
}

export interface SidebarGroupActionProps {
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
}

export interface SidebarGroupContentProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarMenuProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarMenuItemProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarMenuButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | ReactNode;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}

export interface SidebarMenuActionProps {
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
  showOnHover?: boolean;
}

export interface SidebarMenuBadgeProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarMenuSkeletonProps {
  className?: string;
  showIcon?: boolean;
}

export interface SidebarMenuSubProps {
  children?: ReactNode;
  className?: string;
}

export interface SidebarMenuSubItemProps {
  children?: ReactNode;
}

export interface SidebarMenuSubButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
  size?: "sm" | "md";
  isActive?: boolean;
}

export interface SidebarItemProps {
  href: string;
  icon: (props: { className?: string }) => ReactNode;
  children?: ReactNode;
  className?: string;
}

export interface SidebarContextValue {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (value: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (value: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}
