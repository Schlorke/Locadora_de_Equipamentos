/** Configuração de transporte do host Expo; o destino da API pode ser trocado sem mover os arquivos públicos. */
export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || ''

const configuredAssetOrigin = process.env.EXPO_PUBLIC_ASSET_URL?.trim()
function assetOrigin(): string {
  if (!configuredAssetOrigin) return apiBaseUrl
  let url: URL
  try {
    url = new URL(configuredAssetOrigin)
  } catch {
    throw new Error(
      'EXPO_PUBLIC_ASSET_URL deve conter somente uma origem HTTP(S).'
    )
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'EXPO_PUBLIC_ASSET_URL deve conter somente uma origem HTTP(S).'
    )
  }
  return url.origin
}

const publicAssetOrigin = assetOrigin()
/** URLs absolutas do catálogo ficam intactas; caminhos relativos usam a origem pública, sem cookies ou headers da API. */
export function resolvePublicAssetUrl(src: string): string {
  return src.startsWith('/') ? publicAssetOrigin + src : src
}
