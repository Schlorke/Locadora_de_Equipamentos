"use client";

import * as React from "react";
import { cn } from "./cn";
import { FIELD_FRAME, FILTER_FIELD_FRAME } from "./field";

export type InputProps = React.ComponentProps<"input"> & {
  onChangeText?: (value: string) => void;
  testID?: string;
  /** `filter`: campo de busca da barra de filtros do painel (moldura dos controles de filtro). */
  variant?: "default" | "filter";
};

const INPUT_BASE =
  "flex h-10 w-full rounded-md border border-input bg-background text-slate-900 dark:text-slate-50 px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const FRAMES = { default: FIELD_FRAME, filter: FILTER_FIELD_FRAME } as const;

const STEP_BUTTON = "w-3 h-3 flex items-center justify-center text-orange-600 hover:text-orange-700 cursor-pointer select-none";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, onChange, onChangeText, testID, variant = "default", ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      onChangeText?.(event.target.value);
    };
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    const handleWheel = React.useCallback(
      (e: React.WheelEvent<HTMLInputElement>) => {
        if (type === "number") {
          e.currentTarget.blur();
        }
        onWheel?.(e);
      },
      [type, onWheel],
    );

    const inputClassName = cn(INPUT_BASE, type === "number" && "pr-6", className, FRAMES[variant]);

    if (type === "number") {
      const isDisabled = props.disabled;
      const step = (direction: "up" | "down") => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputRef.current && !isDisabled) {
          if (direction === "up") inputRef.current.stepUp();
          else inputRef.current.stepDown();
          inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
          inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      const stepClassName = cn(STEP_BUTTON, isDisabled && "opacity-40 cursor-not-allowed pointer-events-none");

      return (
        <div className="relative w-full">
          <input
            suppressHydrationWarning
            type={type}
            className={inputClassName}
            ref={inputRef}
            onWheel={handleWheel}
            onChange={handleChange}
            data-testid={testID}
            {...props}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col justify-center gap-0">
            <span role="button" className={stepClassName} onClick={step("up")} tabIndex={-1} aria-label="Incrementar">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 1L9 7H1L5 1Z" fill="currentColor" />
              </svg>
            </span>
            <span role="button" className={stepClassName} onClick={step("down")} tabIndex={-1} aria-label="Decrementar">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 9L1 3H9L5 9Z" fill="currentColor" />
              </svg>
            </span>
          </div>
        </div>
      );
    }

    return (
      <input
        suppressHydrationWarning
        type={type}
        className={inputClassName}
        ref={inputRef}
        onWheel={handleWheel}
        onChange={handleChange}
        data-testid={testID}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
