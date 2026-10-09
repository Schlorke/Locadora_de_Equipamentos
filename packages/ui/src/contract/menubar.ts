import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface MenubarProps {
  children?: ReactNode;
}

export interface MenubarMenuProps {
  children?: ReactNode;
}

export interface MenubarTriggerProps {
  children?: ReactNode;
}

export interface MenubarContentProps {
  children?: ReactNode;
}

export interface MenubarItemProps {
  children?: ReactNode;
  disabled?: boolean;
  inset?: boolean;
  onSelect?: () => void;
}

export interface MenubarLabelProps {
  children?: ReactNode;
  inset?: boolean;
}

export interface MenubarSeparatorProps {
  children?: ReactNode;
}

export interface MenubarCheckboxItemProps {
  children?: ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export interface MenubarRadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

export interface MenubarRadioItemProps {
  value: string;
  children?: ReactNode;
  disabled?: boolean;
}

export interface MenubarSubProps {
  children?: ReactNode;
}

export interface MenubarSubTriggerProps {
  children?: ReactNode;
  inset?: boolean;
}

export interface MenubarSubContentProps {
  children?: ReactNode;
}

export interface MenubarShortcutProps {
  children?: ReactNode;
}

export interface MenubarGroupProps {
  children?: ReactNode;
}

export interface MenubarPortalProps {
  children?: ReactNode;
}
