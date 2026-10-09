import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do Embla. */
export interface CarouselProps {
  orientation?: "horizontal" | "vertical";
  children?: ReactNode;
  className?: string;
}

export interface CarouselContentProps {
  children?: ReactNode;
  className?: string;
}

export interface CarouselItemProps {
  children?: ReactNode;
  className?: string;
}

export interface CarouselPreviousProps {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export interface CarouselNextProps {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}
