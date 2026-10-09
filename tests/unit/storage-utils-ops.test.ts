import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteFileFromStorage,
  deleteFilesFromStorage,
  extractFilePathFromSupabaseUrl,
} from '../../scripts/ops/storage-utils'

/**
 * scripts/ops/storage-utils.ts: porte de lib/storage-utils.ts (onda 135, D9 = portar; quarentena COD-03 transferida)
 * usado por scripts/cleanup-orphaned-images.ts (docs/features/storage-image-cleanup.md). Importar o módulo não cria
 * o cliente administrativo; ele vem de `createSupabaseAdminClient` do backend, só quando um arquivo é removido.
 */
const PUBLIC =
  'https://projeto.supabase.co/storage/v1/object/public/gb-locacoes-images'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('extractFilePathFromSupabaseUrl', () => {
  it('devolve o caminho dentro do bucket, decodificado, de uma URL pública', () => {
    expect(
      extractFilePathFromSupabaseUrl(`${PUBLIC}/equipments/andaime%201.webp`)
    ).toBe('equipments/andaime 1.webp')
    expect(
      extractFilePathFromSupabaseUrl(
        'https://outro.supabase.co/storage/v1/object/public/outro-bucket/a/b.png'
      )
    ).toBe('a/b.png')
  })

  it('aceita caminho relativo e recusa o que não é do Storage', () => {
    expect(extractFilePathFromSupabaseUrl('equipments/x.jpg')).toBe(
      'equipments/x.jpg'
    )
    expect(extractFilePathFromSupabaseUrl('/equipments/x.jpg')).toBeNull()
    expect(
      extractFilePathFromSupabaseUrl('https://cdn.example/equipments/x.jpg')
    ).toBeNull()
    expect(extractFilePathFromSupabaseUrl('')).toBeNull()
  })
})

describe('remoção no bucket', () => {
  it('URL inválida não chega ao cliente administrativo', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      deleteFileFromStorage('https://cdn.example/x.jpg')
    ).resolves.toEqual({
      success: false,
      error: 'URL inválida ou não é do Supabase Storage',
    })
  })

  it('o cliente vem do backend no primeiro uso e a falha de configuração vira resultado, sem exceção', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await deleteFilesFromStorage([
      `${PUBLIC}/equipments/a.webp`,
      'https://cdn.example/b.webp',
    ])
    expect(result.success).toBe(false)
    expect(result.deleted).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.errors[0]).toEqual({
      url: `${PUBLIC}/equipments/a.webp`,
      error: expect.stringContaining(
        'Missing Supabase admin environment variables'
      ),
    })
    expect(await deleteFilesFromStorage([])).toEqual({
      success: true,
      deleted: 0,
      failed: 0,
      errors: [],
    })
  })
})
