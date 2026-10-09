'use client'
import { useSearchParams } from 'next/navigation'
import { useFinancialDataModel } from './carga'
import { financialReportPorts } from './export.web'
export function useFinancialData() {
  return useFinancialDataModel(useSearchParams(), financialReportPorts)
}
