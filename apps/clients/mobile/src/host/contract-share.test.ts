import { expect, it, vi } from 'vitest'
vi.mock('expo-file-system', () => ({
  File: class {},
  Paths: { cache: 'file:///cache' },
}))
vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}))
import { createContractShare } from './contract-share'
function fixture() {
  let exists = false
  const file = {
    uri: 'file:///cache/contract',
    get exists() {
      return exists
    },
    write: vi.fn(() => {
      exists = true
    }),
    delete: vi.fn(() => {
      exists = false
    }),
  }
  return {
    file,
    ports: {
      available: vi.fn(async () => true),
      read: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
      file: vi.fn(() => file),
      share: vi.fn(async () => {}),
    },
  }
}
it('compartilha bytes/MIME autenticados, codifica nome e remove somente o arquivo criado', async () => {
  const { file, ports } = fixture()
  await createContractShare(ports)({
    blob: new Blob(['pdf'], { type: 'application/pdf' }),
    name: 'contrato-a/b.html',
    isCurrent: () => true,
  })
  expect(ports.file).toHaveBeenCalledWith('contrato-a%2Fb.html')
  expect(file.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
  expect(ports.share).toHaveBeenCalledWith(file.uri, 'application/pdf')
  expect(file.delete).toHaveBeenCalledTimes(1)
})
it('indisponibilidade não lê/cria arquivo', async () => {
  const { ports } = fixture()
  ports.available.mockResolvedValue(false)
  await expect(
    createContractShare(ports)({
      blob: new Blob(),
      name: 'c.html',
      isCurrent: () => true,
    })
  ).rejects.toThrow('Compartilhamento indisponível')
  expect(ports.read).not.toHaveBeenCalled()
  expect(ports.file).not.toHaveBeenCalled()
})
it.each(['available', 'read'])(
  'escopo encerrado durante %s não abre compartilhamento',
  async (phase) => {
    const { ports } = fixture()
    let current = true
    if (phase === 'available')
      ports.available.mockImplementation(async () => {
        current = false
        return true
      })
    else
      ports.read.mockImplementation(async () => {
        current = false
        return new ArrayBuffer(0)
      })
    await expect(
      createContractShare(ports)({
        blob: new Blob(),
        name: 'c.html',
        isCurrent: () => current,
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(ports.file).not.toHaveBeenCalled()
    expect(ports.share).not.toHaveBeenCalled()
  }
)
it('falha de compartilhamento limpa o arquivo sem engolir erro', async () => {
  const { ports, file } = fixture()
  ports.share.mockRejectedValue(new Error('Falha'))
  await expect(
    createContractShare(ports)({
      blob: new Blob(),
      name: 'c.html',
      isCurrent: () => true,
    })
  ).rejects.toThrow('Falha')
  expect(file.delete).toHaveBeenCalledTimes(1)
})

it('PDF de reajuste recebe seu título mantendo limpeza do cache', async () => {
  const { file, ports } = fixture()
  await createContractShare(ports)({
    blob: new Blob(['pdf'], { type: 'application/pdf' }),
    name: 'Reajuste-Q1.pdf',
    isCurrent: () => true,
    dialogTitle: 'Baixar Reajuste',
  })
  expect(ports.share).toHaveBeenCalledWith(
    file.uri,
    'application/pdf',
    'Baixar Reajuste'
  )
  expect(file.delete).toHaveBeenCalledTimes(1)
})

it('anexo sem MIME usa fallback binário, conservando limpeza e default de contratos', async () => {
  const { file, ports } = fixture()
  await createContractShare(ports)({
    blob: new Blob(['bytes']),
    name: 'anexo.bin',
    isCurrent: () => true,
    fallbackMimeType: 'application/octet-stream',
    dialogTitle: 'Baixar Anexo',
  })
  expect(ports.share).toHaveBeenCalledWith(
    file.uri,
    'application/octet-stream',
    'Baixar Anexo'
  )
  expect(file.delete).toHaveBeenCalledTimes(1)
})
