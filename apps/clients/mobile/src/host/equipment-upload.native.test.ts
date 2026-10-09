import { expect, it, vi } from 'vitest'
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
import { createEquipmentImagePicker } from './equipment-upload.native'
it('cancelar não cria multipart; cada seleção conserva URI, nome, MIME e campo file', async () => {
  const append = vi.fn(),
    form = vi.fn(() => ({ append }) as unknown as FormData)
  expect(
    await createEquipmentImagePicker(
      async () => ({ canceled: true, assets: null }),
      form
    )()
  ).toEqual([])
  expect(form).not.toHaveBeenCalled()
  const pick = createEquipmentImagePicker(
    async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/photo.jpg',
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
        },
        {
          uri: 'file:///cache/loss.png',
          name: 'loss.png',
          mimeType: 'image/png',
        },
      ],
    }),
    form
  )
  expect(await pick()).toHaveLength(2)
  expect(append.mock.calls).toEqual([
    [
      'file',
      { uri: 'file:///cache/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' },
    ],
    [
      'file',
      { uri: 'file:///cache/loss.png', name: 'loss.png', type: 'image/png' },
    ],
  ])
})
