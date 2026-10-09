import type { ReactNode } from "react";

export type HoverActionMenuPosition =
  | "top-center"
  | "top-left"
  | "top-right"
  | "bottom-center"
  | "bottom-left"
  | "bottom-right";

/** Recorte compartilhado web/nativo. groupName/offset/classNames são específicos do web (Tailwind). */
export interface HoverActionMenuProps {
  children: ReactNode;
  position?: HoverActionMenuPosition;
  offset?: string;
  groupName?: string;
  wrapperClassName?: string;
  buttonClassName?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
}
