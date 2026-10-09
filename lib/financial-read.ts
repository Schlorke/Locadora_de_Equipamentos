import {
  createFinancialAging,
  createFinancialCalendar,
  createFinancialEntries,
  createFinancialRevenue,
  createFinancialSettings,
  createFinancialExport,
} from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
export const { readFinancialAging } = createFinancialAging({
  withTenantTransaction,
})
export const { readFinancialCalendar } = createFinancialCalendar({
  withTenantTransaction,
})
export const { readFinancialEntries } = createFinancialEntries({
  withTenantTransaction,
})
export const { readFinancialRevenue } = createFinancialRevenue({
  withTenantTransaction,
})
export const { readFinancialSettings } = createFinancialSettings({
  withTenantTransaction,
})
export const { readFinancialExport } = createFinancialExport({
  withTenantTransaction,
})
