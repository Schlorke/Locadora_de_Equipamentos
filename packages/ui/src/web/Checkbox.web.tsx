"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "./cn";
import { HALO_FOCUS_OUTLINE } from "./focus-ring";

/** `header`: sobre o fundo laranja do cabeçalho de tabela, com fundo branco enquanto desmarcada. */
const checkboxVariants = {
  default: "",
  header: "bg-white",
};

/**
 * Moldura da caixa de seleção, depois do className do consumidor: borda cinza, laranja no hover e no foco (com halo
 * de 3px no lugar do contorno) e laranja cheio quando marcada (mais escuro no hover). Contorno só nas cores forçadas e
 * só no teclado, onde o halo some (HALO_FOCUS_OUTLINE).
 */
const CHECKBOX_FRAME = [
  "border-checkbox hover-always:border-checkbox-checked focus:border-checkbox-checked focus:shadow-checkbox-focus",
  HALO_FOCUS_OUTLINE,
  "data-[state=checked]:border-checkbox-checked data-[state=checked]:bg-checkbox-checked data-[state=checked]:text-white data-[state=checked]:hover-always:border-checkbox-checked-hover data-[state=checked]:hover-always:bg-checkbox-checked-hover",
].join(" ");

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    variant?: keyof typeof checkboxVariants;
  }
>(({ className, variant = "default", ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border-2 disabled:cursor-not-allowed disabled:opacity-50",
      checkboxVariants[variant],
      className,
      CHECKBOX_FRAME,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current w-full h-full")}>
      <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
