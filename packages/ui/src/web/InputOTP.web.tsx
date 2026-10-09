"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { Dot } from "lucide-react";
import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * O input-otp grava `box-shadow: none` inline no campo invisível que cobre os slots, e o estilo inline vence as
 * regras do CSS. A sombra de campo do design system (regra global de campos) só vencia essa declaração com
 * !important. Sem !important, o campo tira apenas essa declaração inline quando monta e a sombra de campo volta a
 * valer; as demais declarações inline da biblioteca ficam como estão.
 */
function useFieldShadowRef(
  forwarded: React.ForwardedRef<HTMLInputElement>,
): React.RefCallback<HTMLInputElement> {
  return React.useCallback(
    (node: HTMLInputElement | null) => {
      node?.style.removeProperty("box-shadow");
      if (typeof forwarded === "function") forwarded(node);
      else if (forwarded) forwarded.current = node;
    },
    [forwarded],
  );
}

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => {
  const inputRef = useFieldShadowRef(ref);
  return (
    <OTPInput
      ref={inputRef}
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
});
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const slot = inputOTPContext.slots[index];
  const { char, hasFakeCaret, isActive } = slot || {
    char: "",
    hasFakeCaret: false,
    isActive: false,
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Dot />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
