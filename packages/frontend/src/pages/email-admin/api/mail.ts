import type {
  HttpClient,
  HttpTextResponse,
  HttpBinaryResponse,
} from '../../../shared/api'

/** Ponte temporária para os leitores existentes; o corpo já foi consumido pelo transporte. */
export function createMailApi(client: HttpClient & { isCurrent(): boolean }) {
  const assertCurrent = () => {
    if (!client.isCurrent())
      throw Object.assign(new Error('Solicitação de um escopo encerrado.'), {
        name: 'AbortError',
      })
  }
  const assertPath = (path: string) => {
    if (!path.startsWith('/api/admin/zoho-mail/'))
      throw new Error('Caminho inválido do correio.')
  }
  return {
    isCurrent: client.isCurrent,
    assertCurrent,
    async request(
      path: string,
      options: {
        method?: string
        body?: string | FormData
        headers?: Record<string, string>
      } = {}
    ): Promise<Pick<Response, 'ok' | 'status' | 'json'>> {
      assertPath(path)
      assertCurrent()
      const { body, ...init } = options
      const result = await client.request<HttpTextResponse>(path, {
        ...init,
        ...(typeof body === 'string'
          ? { body }
          : body
            ? { multipart: body }
            : {}),
        responseType: 'text-response',
      })
      assertCurrent()
      return {
        ok: result.ok,
        status: result.status,
        json: async () => {
          assertCurrent()
          return JSON.parse(result.text)
        },
      }
    },
    async download(path: string): Promise<Pick<Response, 'ok' | 'blob'>> {
      assertPath(path)
      assertCurrent()
      const result = await client.request<HttpBinaryResponse>(path, {
        responseType: 'binary',
      })
      assertCurrent()
      return {
        ok: result.ok,
        blob: async () => {
          assertCurrent()
          return result.blob
        },
      }
    },
  }
}
