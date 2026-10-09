import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do input-otp. */
export interface InputOTPProps {
  maxLength?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export interface InputOTPGroupProps {
  children?: ReactNode;
}

export interface InputOTPSlotProps {
  index: number;
  children?: ReactNode;
}

export interface InputOTPSeparatorProps {
  children?: ReactNode;
}
