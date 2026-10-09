import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface ProgressProps {
  value?: number | null;
  children?: ReactNode;
}
