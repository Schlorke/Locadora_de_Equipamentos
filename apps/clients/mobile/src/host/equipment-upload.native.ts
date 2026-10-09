import * as DocumentPicker from 'expo-document-picker'
interface Asset {
  uri: string
  name: string
  mimeType?: string
}
interface Picker {
  (): Promise<{ canceled: boolean; assets: Asset[] | null }>
}
export function createEquipmentImagePicker(
  pick: Picker,
  form: () => FormData = () => new FormData()
) {
  return async () => {
    const result = await pick()
    if (result.canceled || !result.assets) return []
    return result.assets.map((asset) => {
      const body = form()
      // RN FormData accepts a local URI descriptor; the browser File signature omits it.
      body.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      } as unknown as Blob)
      return body
    })
  }
}
export const pickEquipmentImageFiles = createEquipmentImagePicker(() =>
  DocumentPicker.getDocumentAsync({
    type: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ],
    multiple: true,
    copyToCacheDirectory: true,
  })
)
