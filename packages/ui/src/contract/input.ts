import type { ReactNode } from "react";

/** Recorte usado pelo catálogo e pelo nativo. O web aceita os atributos de input. */
export interface InputProps {
  value?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
  onChangeText?: (value: string) => void;
  testID?: string;
  children?: ReactNode;
}
