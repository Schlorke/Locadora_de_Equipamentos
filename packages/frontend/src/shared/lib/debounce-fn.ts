/**
 * Debounce function - delays execution until after wait time has passed
 * (origem na antiga lib/utils.ts, retirada em F). NÃO unificar com useDebounce em debounce.ts.
 */
export function debounce<T extends (..._args: unknown[]) => void>(
  fn: T,
  wait: number
): (..._args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      fn(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}
