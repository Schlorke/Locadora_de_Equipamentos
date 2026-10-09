"use client";

import { MessageCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { WhatsAppButtonProps } from "../contract/whatsapp-button";
import { Button } from "./Button.web";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function WhatsAppButton({
  onClick,
  disabled = false,
  className,
  variant = "default",
  size = "default",
  children,
}: WhatsAppButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={cn(
        "bg-green-600 hover:bg-green-700 text-white",
        "transition-all duration-200 hover:scale-105",
        "shadow-lg hover:shadow-xl",
        className,
      )}
    >
      <MessageCircle className="w-4 h-4 mr-2" />
      {children || "Solicitar Orçamento"}
    </Button>
  );
}
