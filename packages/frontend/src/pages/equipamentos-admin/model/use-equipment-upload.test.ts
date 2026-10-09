import { expect, it, vi } from 'vitest'
import { pickEquipmentImages, useEquipmentUpload } from './use-equipment-upload'
it('multipart mantém a porta, recusa erro/URL ausente e confere o ciclo depois do HTTP', async () => {
  let current = true,
    revision = 0
  const api = {
    upload: vi.fn(async () => ({
      ok: true,
      data: { url: '/tenant/alfa/image.webp' },
    })),
  }
  const client = { isCurrent: () => current }
  const upload = useEquipmentUpload(
      api as never,
      client as never,
      () => revision
    ),
    body = new FormData()
  expect(await upload(body)).toBe('/tenant/alfa/image.webp')
  expect(api.upload).toHaveBeenCalledWith(body)
  api.upload.mockImplementationOnce(async () => {
    revision++
    return { ok: true, data: { url: 'stale' } }
  })
  await expect(upload(body)).rejects.toMatchObject({ name: 'AbortError' })
  current = false
  const calls = api.upload.mock.calls.length
  await expect(upload(body)).rejects.toMatchObject({ name: 'AbortError' })
  expect(api.upload.mock.calls).toHaveLength(calls)
})
it('picker cancelado, excesso e troca de contexto antes/depois de selecionar não enviam arquivos', async () => {
  const upload = vi.fn(async () => '/ok'),
    body = new FormData()
  expect(
    await pickEquipmentImages(
      async () => [],
      upload,
      5,
      () => true
    )
  ).toEqual([])
  await expect(
    pickEquipmentImages(
      async () => [body, body],
      upload,
      1,
      () => true
    )
  ).rejects.toThrow('limite')
  expect(upload).not.toHaveBeenCalled()
  let current = true
  await expect(
    pickEquipmentImages(
      async () => {
        current = false
        return [body]
      },
      upload,
      5,
      () => current
    )
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(upload).not.toHaveBeenCalled()
})
it('só devolve a lista completa no ciclo original; erro intermediário não fabrica URLs', async () => {
  const files = [new FormData(), new FormData()],
    upload = vi
      .fn(async () => '/one')
      .mockRejectedValueOnce(new Error('Negado'))
  await expect(
    pickEquipmentImages(
      async () => files,
      upload,
      5,
      () => true
    )
  ).rejects.toThrow('Negado')
  expect(upload).toHaveBeenCalledTimes(1)
})

it('falha do servidor e resposta sem URL são erros de upload, sem sucesso fabricado', async () => {
  const client = { isCurrent: () => true },
    body = new FormData()
  const upload = useEquipmentUpload(
    {
      upload: async () => ({ ok: false, data: { error: 'Formato rejeitado' } }),
    } as never,
    client as never
  )
  await expect(upload(body)).rejects.toThrow('Formato rejeitado')
  const malformed = useEquipmentUpload(
    { upload: async () => ({ ok: true, data: { url: undefined } }) } as never,
    client as never
  )
  await expect(malformed(body)).rejects.toThrow('Resposta inválida')
})
