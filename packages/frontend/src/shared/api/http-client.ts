export interface HttpRequest {
  method?: string
  body?: string
  multipart?: FormData
  headers?: Record<string, string>
  signal?: AbortSignal
  cache?: 'no-store'
  responseType?: 'json' | 'json-response' | 'binary' | 'text-response'
}

/** JSON consumido com o status HTTP para fluxos de processamento assíncrono. */
export interface HttpJsonResponse<T> {
  data: T
  ok: boolean
  status: number
}

/** Texto consumido no ciclo do transporte; conserva erros não JSON. */
export interface HttpTextResponse {
  text: string
  ok: boolean
  status: number
  statusText: string
}

/** Corpo consumido antes de sair do ciclo capturado do transporte. */
export interface HttpBinaryResponse {
  blob: Blob
  ok: boolean
  status: number
  url: string
  redirected: boolean
}

export interface HttpClient {
  request<T>(path: string, options?: HttpRequest): Promise<T>
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function createHttpClient({
  baseUrl = '',
  fetcher = (input, init) => fetch(input, init),
  requireBaseUrl = false,
  credentials = 'include',
  getHeaders,
}: {
  baseUrl?: string
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>
  requireBaseUrl?: boolean
  credentials?: 'include' | 'omit' | 'same-origin'
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
} = {}): HttpClient {
  const base = baseUrl.replace(/\/$/, '')
  return {
    async request<T>(path: string, options: HttpRequest = {}): Promise<T> {
      if (requireBaseUrl && !base)
        throw new Error(
          'Configure EXPO_PUBLIC_API_URL para conectar o aplicativo.'
        )
      if (!path.startsWith('/') || path.startsWith('//'))
        throw new Error(
          'O caminho da API deve ser relativo ao host configurado.'
        )
      const { responseType = 'json', multipart, ...init } = options
      if (multipart && init.body !== undefined)
        throw new Error('Envie um corpo JSON ou multipart por solicitação.')
      const response = await fetcher(base + path, {
        ...init,
        ...(multipart ? { body: multipart } : {}),
        credentials,
        headers: {
          Accept: responseType === 'binary' ? '*/*' : 'application/json',
          ...(await getHeaders?.()),
          ...options.headers,
        },
      })
      if (responseType === 'text-response') {
        return {
          text: await response.text(),
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        } as T
      }
      if (responseType === 'binary') {
        return {
          blob: await response.blob(),
          ok: response.ok,
          status: response.status,
          url: response.url,
          redirected: response.redirected,
        } as T
      }
      const data: unknown = await response.json().catch(() => null)
      if (responseType === 'json-response') {
        return { data, ok: response.ok, status: response.status } as T
      }
      if (!response.ok) {
        const error =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Não foi possível concluir a solicitação.'
        throw new HttpError(error, response.status)
      }
      if (data === null) throw new Error('Resposta inválida da API.')
      return data as T
    },
  }
}
