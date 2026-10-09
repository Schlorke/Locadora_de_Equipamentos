"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "./cn";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "../contract/button";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

/** Variantes com moldura própria: como gatilho de um conteúdo aberto (aria-controls), ficam fora da moldura de
 * gatilho (variante controls: de TRIGGER_FRAME, packages/frontend/src/app/styles/utilities.web.css). */
const OWN_FRAME_VARIANTS: ReadonlySet<ButtonVariant> = new Set<ButtonVariant>(["filter-reset", "header-action"]);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-own-frame={variant && OWN_FRAME_VARIANTS.has(variant) ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
