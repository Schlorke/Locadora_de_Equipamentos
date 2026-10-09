import { afterEach, describe, expect, it, vi } from 'vitest'

async function config(api: string | undefined, assets?: string) {
  vi.resetModules()
  vi.stubEnv('EXPO_PUBLIC_API_URL', api)
  vi.stubEnv('EXPO_PUBLIC_ASSET_URL', assets)
  return import('./api-config')
}
afterEach(() => vi.unstubAllEnvs())

describe('destinos do host Expo', () => {
  it('preserva a origem legada das imagens quando a configuração separada não existe', async () => {
    const { apiBaseUrl, resolvePublicAssetUrl } = await config(
      'https://legacy.example/'
    )
    expect(apiBaseUrl).toBe('https://legacy.example')
    expect(resolvePublicAssetUrl('/models/equipamento.glb')).toBe(
      'https://legacy.example/models/equipamento.glb'
    )
    expect(resolvePublicAssetUrl('https://storage.example/image.png')).toBe(
      'https://storage.example/image.png'
    )
    expect(resolvePublicAssetUrl('data:image/png;base64,AA==')).toBe(
      'data:image/png;base64,AA=='
    )
  })

  it('troca a API e conserva os arquivos no web; rollback só muda a configuração', async () => {
    for (const api of ['http://127.0.0.1:3002', 'http://127.0.0.1:3000']) {
      const { apiBaseUrl, resolvePublicAssetUrl } = await config(
        api,
        'http://localhost:3001/'
      )
      expect(apiBaseUrl).toBe(api)
      expect(resolvePublicAssetUrl('/equipamentos/image.png')).toBe(
        'http://localhost:3001/equipamentos/image.png'
      )
      expect(resolvePublicAssetUrl('https://storage.example/image.png')).toBe(
        'https://storage.example/image.png'
      )
    }
  })

  it.each([
    'ftp://assets.example',
    'https://user:password@assets.example',
    'https://assets.example/files',
    'https://assets.example?token=secret',
    'https://assets.example#fragment',
    'invalid',
  ])(
    'recusa origem pública inválida sem repetir seu valor: %s',
    async (assets) => {
      await expect(config('http://127.0.0.1:3002', assets)).rejects.toThrow(
        'EXPO_PUBLIC_ASSET_URL deve conter somente uma origem HTTP(S).'
      )
    }
  )

  it('não inventa destino quando o aplicativo ainda não foi configurado', async () => {
    const { apiBaseUrl, resolvePublicAssetUrl } = await config(undefined)
    expect(apiBaseUrl).toBe('')
    expect(resolvePublicAssetUrl('/image.png')).toBe('/image.png')
  })
})
