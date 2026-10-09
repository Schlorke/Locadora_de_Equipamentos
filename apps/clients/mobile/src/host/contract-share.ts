import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

interface DownloadedContract {
  blob: Blob
  name: string
  isCurrent: () => boolean
  dialogTitle?: string
  fallbackMimeType?: string
}
interface CachedFile {
  uri: string
  write(bytes: Uint8Array): void
  delete(): void
  exists: boolean
}
interface SharePorts {
  available(): Promise<boolean>
  read(blob: Blob): Promise<ArrayBuffer>
  file(name: string): CachedFile
  share(uri: string, mimeType: string, dialogTitle?: string): Promise<void>
}
const stale = () =>
  Object.assign(new Error('Escopo encerrado.'), { name: 'AbortError' })
/** Integração nativa somente: recebe bytes já autenticados, sem nova chamada HTTP. */
export function createContractShare(ports: SharePorts) {
  return async ({
    blob,
    name,
    isCurrent,
    dialogTitle,
    fallbackMimeType,
  }: DownloadedContract) => {
    const check = () => {
      if (!isCurrent()) throw stale()
    }
    check()
    const available = await ports.available()
    check()
    if (!available)
      throw new Error('Compartilhamento indisponível neste aparelho.')
    const bytes = await ports.read(blob)
    check()
    const file = ports.file(encodeURIComponent(name))
    try {
      file.write(new Uint8Array(bytes))
      check()
      if (dialogTitle)
        await ports.share(
          file.uri,
          blob.type || fallbackMimeType || 'text/html',
          dialogTitle
        )
      else
        await ports.share(
          file.uri,
          blob.type || fallbackMimeType || 'text/html'
        )
      check()
    } finally {
      if (file.exists) file.delete()
    }
  }
}
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error('Arquivo inválido.'))
    reader.onerror = () =>
      reject(reader.error || new Error('Falha ao ler contrato.'))
    reader.readAsArrayBuffer(blob)
  })
}
let sequence = 0
export const shareDownloadedContract = createContractShare({
  available: Sharing.isAvailableAsync,
  read: readBlob,
  file: (name) => {
    const file = new File(
      Paths.cache,
      Date.now() + '-' + ++sequence + '-' + name
    )
    return {
      uri: file.uri,
      get exists() {
        return file.exists
      },
      write(bytes) {
        file.create()
        file.write(bytes)
      },
      delete() {
        file.delete()
      },
    }
  },
  share: (uri, mimeType, dialogTitle) =>
    Sharing.shareAsync(uri, {
      mimeType,
      UTI:
        mimeType === 'application/pdf'
          ? 'com.adobe.pdf'
          : mimeType === 'text/html'
            ? 'public.html'
            : 'public.data',
      dialogTitle: dialogTitle || 'Baixar Contrato',
    }),
})
