export const MOBILE_BREAKPOINT = 768;

export function mobileMediaQuery(): string {
  return `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
}
