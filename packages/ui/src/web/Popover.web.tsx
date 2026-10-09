"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { clsx, type ClassValue } from "clsx";
import * as React from "react";
import { useReleaseScrollLockRef } from "./release-scroll-lock";
import { TRIGGER_FRAME } from "./trigger";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ className, ...props }, ref) => <PopoverPrimitive.Trigger ref={ref} className={cn(TRIGGER_FRAME, className)} {...props} />);
PopoverTrigger.displayName = "PopoverTrigger";
const PopoverClose = PopoverPrimitive.Close;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  const contentRef = useReleaseScrollLockRef(ref);
  return (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={contentRef}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[95] w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2",
        "data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2",
        "data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
