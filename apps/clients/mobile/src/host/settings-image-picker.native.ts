import * as DocumentPicker from 'expo-document-picker'
import { createEquipmentImagePicker } from './equipment-upload.native'
interface Asset {
  uri: string
  name: string
  mimeType?: string
  size?: number
}
type Pick = (
  multiple: boolean
) => Promise<{ canceled: boolean; assets: Asset[] | null }>
export function createSettingsImagePicker(
  pick: Pick,
  form: () => FormData = () => new FormData()
) {
  return async (multiple: boolean) => {
    const selected = await pick(multiple)
    const bodies = await createEquipmentImagePicker(
      async () => selected,
      form
    )()
    return bodies.map((multipart, index) => ({
      multipart,
      type: selected.assets![index]!.mimeType || 'application/octet-stream',
      size: selected.assets![index]!.size ?? 0,
    }))
  }
}
export const pickSettingsImages = createSettingsImagePicker((multiple) =>
  DocumentPicker.getDocumentAsync({
    type: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ],
    multiple,
    copyToCacheDirectory: true,
  })
)
