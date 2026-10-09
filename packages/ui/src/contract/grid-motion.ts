import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. gradientColor no web aceita valor CSS ou nome. */
export interface GridMotionProps {
  items?: (string | ReactNode)[];
  gradientColor?: string;
}
