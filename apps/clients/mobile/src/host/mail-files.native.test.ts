import { expect, it, vi } from 'vitest'
import { createMailFilePicker } from './mail-files.native'
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
vi.mock('expo-file-system', () => ({ File: class {} }))
it('conserva múltiplos files, URI/MIME e tamanho real quando picker o omite', async () => {
  const append = vi.fn(),
    size = vi.fn(() => 42)
  const pick = createMailFilePicker(
    async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///one.pdf',
          name: 'one.pdf',
          size: 17,
          mimeType: 'application/pdf',
        },
        { uri: 'file:///two', name: 'two' },
      ],
    }),
    size,
    () => ({ append }) as unknown as FormData
  )
  const result = await pick()
  expect(result?.files).toEqual([
    { name: 'one.pdf', size: 17 },
    { name: 'two', size: 42 },
  ])
  expect(append.mock.calls).toEqual([
    [
      'files',
      { uri: 'file:///one.pdf', name: 'one.pdf', type: 'application/pdf' },
    ],
    [
      'files',
      { uri: 'file:///two', name: 'two', type: 'application/octet-stream' },
    ],
  ])
  expect(size).toHaveBeenCalledWith('file:///two')
})
it('cancelamento não lê arquivos nem cria multipart', async () => {
  const size = vi.fn(),
    form = vi.fn()
  expect(
    await createMailFilePicker(
      async () => ({ canceled: true, assets: null }),
      size,
      form
    )()
  ).toBeNull()
  expect(size).not.toHaveBeenCalled()
  expect(form).not.toHaveBeenCalled()
})
it.each([NaN, -1])(
  'metadado de tamanho inválido não chega ao upload: %s',
  (size) =>
    expect(
      createMailFilePicker(
        async () => ({
          canceled: false,
          assets: [{ uri: 'file:///file', name: 'file', size }],
        }),
        () => 0
      )()
    ).rejects.toThrow('tamanho do anexo')
)
