import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Radix. */
export interface AspectRatioProps {
  ratio?: number;
  children?: ReactNode;
}
