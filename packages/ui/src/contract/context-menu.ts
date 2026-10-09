import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface ContextMenuProps {
  children?: ReactNode;
}

export interface ContextMenuTriggerProps {
  children?: ReactNode;
}

export interface ContextMenuContentProps {
  children?: ReactNode;
}

export interface ContextMenuItemProps {
  children?: ReactNode;
  disabled?: boolean;
  inset?: boolean;
  onSelect?: () => void;
}

export interface ContextMenuLabelProps {
  children?: ReactNode;
  inset?: boolean;
}

export interface ContextMenuSeparatorProps {
  children?: ReactNode;
}

export interface ContextMenuCheckboxItemProps {
  children?: ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export interface ContextMenuRadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

export interface ContextMenuRadioItemProps {
  value: string;
  children?: ReactNode;
  disabled?: boolean;
}

export interface ContextMenuSubProps {
  children?: ReactNode;
}

export interface ContextMenuSubTriggerProps {
  children?: ReactNode;
  inset?: boolean;
}

export interface ContextMenuSubContentProps {
  children?: ReactNode;
}

export interface ContextMenuShortcutProps {
  children?: ReactNode;
}

export interface ContextMenuGroupProps {
  children?: ReactNode;
}

export interface ContextMenuPortalProps {
  children?: ReactNode;
}
