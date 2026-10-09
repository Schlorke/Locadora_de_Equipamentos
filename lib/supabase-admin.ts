import { createSupabaseAdminClient } from '@gb-locacoes/backend/runtime'

// Preserve eager initialization for existing callers; the shared service uses
// the lazy private-storage composition of this same administrative SDK client.
export const supabaseAdmin = createSupabaseAdminClient()
export default supabaseAdmin
