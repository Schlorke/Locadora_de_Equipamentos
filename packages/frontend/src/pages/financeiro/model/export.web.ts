'use client'
import {
  useFinancialExport as useExport,
  type FinancialFilePorts,
} from './export'
import type { HttpClient } from '../../../shared/api'
export const financialReportPorts: FinancialFilePorts = {
  open() {
    const popup = window.open('', '_blank')
    if (!popup) return null
    return {
      isOpen: () => !popup.closed,
      close: () => popup.close(),
      deliver({ blob, name, isCurrent }) {
        if (!isCurrent() || popup.closed) {
          popup.close()
          return
        }
        const url = URL.createObjectURL(blob)
        try {
          const link = popup.document.createElement('a')
          link.href = url
          link.download = name
          popup.document.body.appendChild(link)
          link.click()
          link.remove()
        } finally {
          URL.revokeObjectURL(url)
          popup.close()
        }
      },
    }
  },
}
export function useFinancialExport(
  client: HttpClient & { isCurrent(): boolean }
) {
  return useExport(client, financialReportPorts)
}
