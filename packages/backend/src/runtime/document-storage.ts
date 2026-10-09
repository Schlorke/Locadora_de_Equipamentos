import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createPrivateDocumentStorage } from '../modules/documents/private-documents'

export function createSupabaseAdminClient(
  getEnv: () => Record<string, string | undefined> = () => process.env
) {
  const env = getEnv(),
    url = env.NEXT_PUBLIC_SUPABASE_URL,
    key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error(
      'Missing Supabase admin environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    )
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
/** The private storage client is created only when a signed document is requested. */
export function createSupabaseDocumentStorage(
  getEnv: () => Record<string, string | undefined> = () => process.env
) {
  let client: SupabaseClient | undefined
  return createPrivateDocumentStorage({
    async getClient() {
      if (!client) {
        client = createSupabaseAdminClient(getEnv)
      }
      return client
    },
  })
}

export function createSupabaseImageStorage(
  getEnv: () => Record<string, string | undefined> = () => process.env
) {
  let client: SupabaseClient | undefined
  return {
    async getImageStorage() {
      client ??= createSupabaseAdminClient(getEnv)
      return client.storage.from('gb-locacoes-images')
    },
  }
}
