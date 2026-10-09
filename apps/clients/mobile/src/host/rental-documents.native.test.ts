import { expect, it, vi } from 'vitest'
const open = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
vi.mock('react-native', () => ({ Linking: { openURL: open } }))
import {
  createRentalDocumentPicker,
  openRentalDocument,
} from './rental-documents.native'
it('cancelar não cria corpo; seleção conserva URI/nome/MIME e apenas campo file', async () => {
  const append = vi.fn(),
    form = vi.fn(() => ({ append }) as unknown as FormData)
  expect(
    await createRentalDocumentPicker(
      async () => ({ canceled: true, assets: null }),
      form
    )()
  ).toBeNull()
  expect(form).not.toHaveBeenCalled()
  await createRentalDocumentPicker(
    async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/proof.pdf',
          name: 'proof.pdf',
          mimeType: 'application/pdf',
        },
      ],
    }),
    form
  )()
  expect(append).toHaveBeenCalledExactlyOnceWith('file', {
    uri: 'file:///cache/proof.pdf',
    name: 'proof.pdf',
    type: 'application/pdf',
  })
})
it('abre URL recebida sem inventar origem, recusa esquema executável', async () => {
  await openRentalDocument(
    'https://storage.example.test/private?signature=fixture'
  )
  expect(open).toHaveBeenCalledWith(
    'https://storage.example.test/private?signature=fixture'
  )
  await expect(openRentalDocument('javascript:alert(1)')).rejects.toThrow(
    'URL de documento inválida'
  )
  expect(open).toHaveBeenCalledTimes(1)
})
