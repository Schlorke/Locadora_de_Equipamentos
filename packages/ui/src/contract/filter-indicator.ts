export type FilterIndicatorSize = "sm" | "md" | "lg";

/** Recorte compartilhado web/nativo. activeColor/inactiveColor no web são classes Tailwind. */
export interface FilterIndicatorProps {
  isFiltered: boolean;
  className?: string;
  size?: FilterIndicatorSize;
  activeColor?: string;
  inactiveColor?: string;
}
