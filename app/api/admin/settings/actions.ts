import 'server-only'
import { createAdminSettings } from '@gb-locacoes/backend/catalog'
import { createAdminStorefrontLegalHandlers } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
import { revalidatePath } from 'next/cache'
const settings = createAdminSettings({
  withTenantTransaction,
  revalidatePath,
})
export const { getSettings, updateSettings } = settings
/** Textos legais da vitrine no painel (onda 134): a mesma composição do serviço (`host/branding.ts`). */
export const adminStorefrontLegal = createAdminStorefrontLegalHandlers({
  getDocument: settings.getLegalDocument,
  saveDocument: settings.saveLegalDocument,
  removeDocument: settings.removeLegalDocument,
})
