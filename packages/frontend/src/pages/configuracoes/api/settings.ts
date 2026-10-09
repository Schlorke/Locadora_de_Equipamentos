import {
  isAbortError,
  type HttpClient,
  type HttpTextResponse,
} from '../../../shared/api'
import type { SettingsInput } from '../model/settings.schema'

export type SettingsActionResult = {
  success: boolean
  data?: Partial<SettingsInput>
  error?: string
  message?: string
}

export function createSettingsApi(client: HttpClient) {
  async function request(options?: {
    method: string
    body: string
    headers: Record<string, string>
  }): Promise<SettingsActionResult> {
    try {
      const result = await client.request<SettingsActionResult>(
        '/api/admin/settings',
        options
      )
      if (typeof result.success !== 'boolean')
        throw new Error('Resposta inválida das configurações.')
      return result
    } catch (error) {
      if (isAbortError(error)) throw error
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao acessar configurações.',
      }
    }
  }
  return {
    getSettings: () => request(),
    uploadLogo: async (multipart: FormData): Promise<{ url: string }> => {
      const response = await client.request<HttpTextResponse>('/api/upload', {
        method: 'POST',
        multipart,
        responseType: 'text-response',
      })
      if (!response.ok) throw new Error('Erro ao fazer upload')
      return JSON.parse(response.text) as { url: string }
    },
    updateSettings: (data: SettingsInput) =>
      request({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    /** Nomes das categorias da locadora (destaques do rodapé: "Usar minhas categorias", onda 134). */
    listCategoryNames: async (): Promise<string[]> => {
      const rows = await client.request<unknown>('/api/admin/categories')
      if (!Array.isArray(rows))
        throw new Error('Resposta inválida das categorias.')
      return rows
        .map((row) =>
          row && typeof row === 'object'
            ? (row as { name?: unknown }).name
            : undefined
        )
        .filter((name): name is string => typeof name === 'string')
    },
  }
}
