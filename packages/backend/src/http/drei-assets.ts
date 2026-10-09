/**
 * Proxy para recursos do drei-assets do GitHub
 * Cacheia as requisições para evitar rate limiting (429)
 *
 * Uso: /api/drei-proxy/hdri/forest_slope_1k.hdr
 * Redireciona para: https://raw.githubusercontent.com/pmndrs/drei-assets/.../hdri/forest_slope_1k.hdr
 *
 * SEGURANÇA:
 * - Só aceita os mapas HDR pedidos pelo código (`presetToPath` em
 *   ModelViewer.web.tsx e o fallback de public/sw.js, ambos `hdri/<arquivo>.hdr`).
 *   Qualquer outro prefixo, `..`, segmento vazio, separador ou sequência
 *   percent-encoded é rejeitado antes de qualquer requisição externa.
 * - Sem CORS: os consumidores são same-origin (componente e service worker).
 *   A plataforma atende várias locadoras; nenhuma origem de marca é fixada aqui.
 * - Conteúdo servido como binário opaco com `nosniff`.
 */
const DREI_ASSETS_BASE =
  'https://raw.githubusercontent.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/'
const ALLOWED_PREFIX = 'hdri'
const ASSET_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]*\.hdr$/

function resolveAssetUrl(segments: readonly string[]): string | null {
  if (segments.length !== 2) return null
  const [prefix, file] = segments
  if (prefix !== ALLOWED_PREFIX || !file || !ASSET_FILE.test(file)) return null
  const relative = `${prefix}/${file}`
  const url = new URL(relative, DREI_ASSETS_BASE)
  // Defesa em profundidade: a URL normalizada precisa ser exatamente base + caminho.
  return url.href === DREI_ASSETS_BASE + relative ? url.href : null
}

export function createDreiAssetProxy(
  fetch: (
    _url: string,
    _options: RequestInit & { next: { revalidate: number } }
  ) => Promise<Response>
) {
  async function GET(
    _request: Request,
    { params }: { params: Promise<{ path: string[] }> }
  ) {
    try {
      const resolvedParams = await params
      const githubUrl = resolveAssetUrl(resolvedParams.path ?? [])
      if (!githubUrl) {
        return Response.json(
          { error: 'Invalid asset path' },
          { status: 400, headers: { 'X-Content-Type-Options': 'nosniff' } }
        )
      }

      // Fazer requisição ao GitHub com cache do servidor
      const response = await fetch(githubUrl, {
        headers: {
          'User-Agent': 'GB-Locacoes/1.0',
        },
        // Cache no servidor da Vercel
        next: { revalidate: 31536000 }, // 1 ano
      })

      if (!response.ok) {
        return Response.json(
          { error: 'Failed to fetch resource' },
          { status: response.status }
        )
      }

      const buffer = await response.arrayBuffer()

      // Retornar com headers de cache agressivo, sem CORS (consumo same-origin)
      const headers = new Headers()
      headers.set('Content-Type', 'application/octet-stream')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')

      return new Response(buffer, {
        status: 200,
        headers,
      })
    } catch (error) {
      console.error('Drei proxy error:', error)
      return Response.json({ error: 'Proxy error' }, { status: 500 })
    }
  }

  return GET
}
