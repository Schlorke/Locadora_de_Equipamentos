import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
interface Asset {
  uri: string
  name: string
  mimeType?: string
  size?: number
}
export function createMailFilePicker(
  pick: () => Promise<{ canceled: boolean; assets: Asset[] | null }>,
  size: (uri: string) => number,
  form: () => FormData = () => new FormData()
) {
  return async () => {
    const result = await pick()
    if (result.canceled || !result.assets?.length) return null
    const multipart = form(),
      files = result.assets.map((asset) => {
        const bytes = asset.size ?? size(asset.uri)
        if (!Number.isFinite(bytes) || bytes < 0)
          throw new Error('Não foi possível ler o tamanho do anexo.')
        // RN FormData aceita descritor local; a assinatura DOM espera Blob.
        multipart.append('files', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        } as unknown as Blob)
        return { name: asset.name, size: bytes }
      })
    return { files, multipart }
  }
}
export const pickMailFiles = createMailFilePicker(
  () =>
    DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    }),
  (uri) => new File(uri).size
)
