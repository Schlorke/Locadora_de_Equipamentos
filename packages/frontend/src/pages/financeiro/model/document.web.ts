'use client'
import { useFinancialDocument as useDocument } from './document'
import type { FinancialFilePorts } from './export'
const ports: FinancialFilePorts = {
  open() {
    const popup = window.open('', '_blank')
    if (!popup) return null
    return {
      isOpen: () => !popup.closed,
      close: () => popup.close(),
      deliver({ blob, isCurrent }) {
        if (!isCurrent() || popup.closed) {
          popup.close()
          return
        }
        const url = URL.createObjectURL(blob)
        popup.addEventListener('load', () => URL.revokeObjectURL(url), {
          once: true,
        })
        popup.location.href = url
      },
    }
  },
}
export function useFinancialDocument(entryId: string | null) {
  return useDocument(entryId, ports)
}
