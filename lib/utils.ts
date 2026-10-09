import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { formatCurrency } from "@gb-locacoes/domain/formatting"

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dateObj)
}

/** Remove colchetes [] da justificativa de ajuste (ex.: "[Deslocamento (Frete)] Teste" → "Deslocamento (Frete) Teste") */
export { formatAdjustmentReason, parseAdjustmentBlocks, ADJUSTMENT_CATEGORY_LABELS } from "@gb-locacoes/domain/orcamento"

/**
 * Debounce function - delays execution until after wait time has passed
 * @param fn - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
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

/**
 * Throttle function - limits execution to once per wait time
 * @param fn - Function to throttle
 * @param wait - Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (..._args: unknown[]) => void>(
  fn: T,
  wait: number
): (..._args: Parameters<T>) => ReturnType<T> | undefined {
  let inThrottle: boolean = false
  let lastResult: ReturnType<T> | undefined

  return function executedFunction(
    ...args: Parameters<T>
  ): ReturnType<T> | undefined {
    if (!inThrottle) {
      lastResult = fn(...args) as ReturnType<T>
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, wait)
    }
    return lastResult
  }
}
