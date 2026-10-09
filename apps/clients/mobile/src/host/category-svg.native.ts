import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
interface Asset {
  uri: string
  name: string
  mimeType?: string
  size?: number
}
type Picker = () => Promise<{ canceled: boolean; assets: Asset[] | null }>
export function createCategorySvgPicker(
  pick: Picker,
  read: (uri: string) => { size: number; text: () => Promise<string> }
) {
  return async () => {
    const result = await pick()
    if (result.canceled || !result.assets?.[0]) return null
    const asset = result.assets[0],
      file = read(asset.uri)
    return {
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
      size: asset.size ?? file.size,
      read: () => file.text(),
    }
  }
}
export const pickCategorySvg = createCategorySvgPicker(
  () =>
    DocumentPicker.getDocumentAsync({
      type: 'image/svg+xml',
      multiple: false,
      copyToCacheDirectory: true,
    }),
  (uri) => new File(uri)
)
