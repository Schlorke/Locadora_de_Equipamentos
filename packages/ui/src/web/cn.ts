import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Sombras próprias dos controles (utilitários `shadow-*` declarados com @utility em
 * packages/frontend/src/app/styles/utilities.web.css). Registradas no tailwind-merge para que `shadow-control` e
 * `shadow-md` se reconheçam como a mesma propriedade (box-shadow) e só a última classe fique.
 */
export const CONTROL_SHADOWS = [
  "control",
  "control-hover",
  "control-focus",
  "control-invalid-focus",
  "textarea",
  "raised",
  "raised-lg",
  "raised-xl",
  "checkbox-focus",
] as const;

const twMerge = extendTailwindMerge({ extend: { theme: { shadow: [...CONTROL_SHADOWS] } } });

/** Junta classes (clsx) e resolve conflitos do Tailwind (tailwind-merge com as sombras dos controles). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
