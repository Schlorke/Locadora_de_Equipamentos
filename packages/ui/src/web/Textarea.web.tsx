import * as React from "react";
import { cn } from "./cn";
import { TEXTAREA_FRAME } from "./field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { onChangeText?: (value: string) => void };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onChangeText, onChange, ...props }, ref) => {
  return (
    <textarea
      suppressHydrationWarning
      className={cn(
        "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
        TEXTAREA_FRAME,
      )}
      ref={ref}
      onChange={event => { onChangeText?.(event.target.value); onChange?.(event); }}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
