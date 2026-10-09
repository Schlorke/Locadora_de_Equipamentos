import { expect, it, vi } from 'vitest'
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
vi.mock('expo-file-system', () => ({ File: vi.fn() }))
import { createCategorySvgPicker } from './category-svg.native'
it('cancelamento não acessa arquivo; selecionado conserva nome, MIME, tamanho e leitura adiada', async () => {
  const text = vi.fn(async () => '<svg/>'),
    read = vi.fn(() => ({ size: 20, text }))
  expect(
    await createCategorySvgPicker(
      async () => ({ canceled: true, assets: null }),
      read
    )()
  ).toBeNull()
  expect(read).not.toHaveBeenCalled()
  const result = await createCategorySvgPicker(
    async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/icon.svg',
          name: 'icon.svg',
          mimeType: 'image/svg+xml',
          size: 15,
        },
      ],
    }),
    read
  )()
  expect(result).toMatchObject({
    name: 'icon.svg',
    type: 'image/svg+xml',
    size: 15,
  })
  expect(read).toHaveBeenCalledWith('file:///cache/icon.svg')
  expect(text).not.toHaveBeenCalled()
  expect(await result!.read()).toBe('<svg/>')
  const missing = await createCategorySvgPicker(
    async () => ({
      canceled: false,
      assets: [{ uri: 'file:///cache/icon.svg', name: 'icon.svg' }],
    }),
    read
  )()
  expect(missing).toMatchObject({ size: 20, type: 'application/octet-stream' })
})
