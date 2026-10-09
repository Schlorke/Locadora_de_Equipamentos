import { createAdminSettings } from '@gb-locacoes/backend/catalog'
import {
  createAdminStorefrontLegalHandlers,
  createImageUpload,
} from '@gb-locacoes/backend/http'
import { createSupabaseImageStorage } from '@gb-locacoes/backend/runtime'
import { withTenantTransaction } from './tenant-transaction'
import { revalidatePath } from 'next/cache'
const settings = createAdminSettings({
  withTenantTransaction,
  revalidatePath,
})
export const { getSettings, updateSettings } = settings
/** Textos legais da vitrine no painel (onda 134): a mesma composição da raiz legada (`app/api/admin/settings/actions.ts`). */
export const adminStorefrontLegal = createAdminStorefrontLegalHandlers({
  getDocument: settings.getLegalDocument,
  saveDocument: settings.saveLegalDocument,
  removeDocument: settings.removeLegalDocument,
})
const { getImageStorage } = createSupabaseImageStorage()
export const { uploadImage } = createImageUpload({
  withTenantTransaction,
  getImageStorage,
})
