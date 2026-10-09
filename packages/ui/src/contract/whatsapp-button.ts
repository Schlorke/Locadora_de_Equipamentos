import type { ReactNode } from "react";

export interface WhatsAppButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  children?: ReactNode;
}
