import { expect, it, vi } from 'vitest'
import { createSettingsImagePicker } from './settings-image-picker.native'
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
it('reutiliza multipart URI do host e entrega metadados da seleção única/múltipla', async () => {
  const selected = {
      canceled: false,
      assets: [
        {
          uri: 'file:///fixture.png',
          name: 'fixture.png',
          mimeType: 'image/png',
          size: 123,
        },
      ],
    },
    append = vi.fn(),
    pick = vi.fn(async () => selected),
    form = () => ({ append }) as unknown as FormData
  const choose = createSettingsImagePicker(pick, form)
  const files = await choose(false)
  expect(pick).toHaveBeenCalledWith(false)
  expect(files[0]).toMatchObject({ type: 'image/png', size: 123 })
  expect(append).toHaveBeenCalledWith('file', {
    uri: 'file:///fixture.png',
    name: 'fixture.png',
    type: 'image/png',
  })
  await choose(true)
  expect(pick).toHaveBeenLastCalledWith(true)
  expect(append).toHaveBeenCalledTimes(2)
})
it('cancelamento não cria formulário e metadados ausentes conservam o fallback do picker existente', async () => {
  const form = vi.fn(() => new FormData()),
    pick = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, assets: null })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///fixture', name: 'fixture' }],
      })
  const choose = createSettingsImagePicker(pick, form)
  expect(await choose(false)).toEqual([])
  expect(form).not.toHaveBeenCalled()
  expect((await choose(true))[0]).toMatchObject({
    type: 'application/octet-stream',
    size: 0,
  })
})
