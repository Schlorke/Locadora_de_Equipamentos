import type { HttpClient, HttpTextResponse } from '../../../shared/api'

export function createWhatsAppApi(client: HttpClient) {
  async function request(
    path: string,
    error: string,
    options?: { method: string; headers: Record<string, string>; body: string }
  ): Promise<unknown> {
    const response = await client.request<HttpTextResponse>(path, {
      ...options,
      responseType: 'text-response',
    })
    if (!response.ok) {
      let data: { error?: string } = {}
      try {
        data = JSON.parse(response.text)
      } catch {
        /* Erro não JSON conserva a mensagem anterior. */
      }
      throw new Error(data?.error ?? error)
    }
    return JSON.parse(response.text) as unknown
  }
  return {
    conversations: (limit: number) =>
      request(
        '/api/admin/whatsapp/conversations?limit=' + limit + '&offset=0',
        'Erro ao carregar conversas'
      ),
    messages: (id: string, limit: number, before?: string) => {
      const query = new URLSearchParams({ limit: String(limit) })
      if (before) query.set('before', before)
      return request(
        '/api/admin/whatsapp/conversations/' +
          encodeURIComponent(id) +
          '/messages?' +
          query,
        'Erro ao carregar mensagens'
      )
    },
    send: (id: string, text: string) =>
      request(
        '/api/admin/whatsapp/conversations/' +
          encodeURIComponent(id) +
          '/messages',
        'Erro ao enviar mensagem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        }
      ),
  }
}
