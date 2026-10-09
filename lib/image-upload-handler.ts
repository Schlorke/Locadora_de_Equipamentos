import { createImageUpload } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
export const { uploadImage } = createImageUpload({
  withTenantTransaction,
  async getImageStorage() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    return supabaseAdmin.storage.from('gb-locacoes-images')
  },
})
