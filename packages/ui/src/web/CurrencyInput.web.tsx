"use client";

import type * as React from "react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Input } from "./Input.web";
import { digitsToCurrencyNumber, formatCurrencyInput, parseCurrencyDigits } from "./currency-input";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: number;
  onValueChange?: (_value: number) => void;
  currency?: string;
  locale?: string;
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value = 0, onValueChange, currency = "BRL", locale = "pt-BR", ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const shouldMoveCursorRef = useRef(false);
    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (!ref) return;
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      },
      [ref],
    );

    const formatCurrency = useCallback((num: number): string => formatCurrencyInput(num, locale, currency), [locale, currency]);

    const [displayValue, setDisplayValue] = useState(() => formatCurrency(value || 0));

    useEffect(() => {
      setDisplayValue(formatCurrency(value || 0));
    }, [value, formatCurrency]);

    const applyDigits = useCallback(
      (digits: string) => {
        const numericValue = digitsToCurrencyNumber(digits);
        setDisplayValue(formatCurrency(numericValue));
        onValueChange?.(numericValue);
      },
      [formatCurrency, onValueChange],
    );

    const moveCursorToEnd = useCallback(() => {
      const input = inputRef.current;
      if (!input) return;
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }, []);

    const scheduleCursorToEnd = useCallback(
      (afterRender?: boolean) => {
        if (afterRender) {
          shouldMoveCursorRef.current = true;
          return;
        }
        requestAnimationFrame(moveCursorToEnd);
      },
      [moveCursorToEnd],
    );

    useLayoutEffect(() => {
      if (!shouldMoveCursorRef.current) return;
      shouldMoveCursorRef.current = false;
      moveCursorToEnd();
    }, [displayValue, moveCursorToEnd]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = parseCurrencyDigits(e.target.value);
      applyDigits(digits);
      scheduleCursorToEnd(true);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      scheduleCursorToEnd();
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const digits = parseCurrencyDigits(e.target.value);
      applyDigits(digits);
      props.onBlur?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      scheduleCursorToEnd();
      props.onClick?.(e);
    };

    return (
      <Input
        {...props}
        ref={setInputRef}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        placeholder="R$ 0,00"
        inputMode="numeric"
      />
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
