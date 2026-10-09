import * as DocumentPicker from 'expo-document-picker'
import { Linking } from 'react-native'
interface Asset {
  uri: string
  name: string
  mimeType?: string
}
export function createRentalDocumentPicker(
  pick: () => Promise<{ canceled: boolean; assets: Asset[] | null }>,
  form: () => FormData = () => new FormData()
) {
  return async () => {
    const result = await pick()
    if (result.canceled || !result.assets?.[0]) return null
    const asset = result.assets[0],
      body = form()
    body.append('file', {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
    } as unknown as Blob)
    return body
  }
}
export const pickRentalDocument = createRentalDocumentPicker(() =>
  DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    multiple: false,
    copyToCacheDirectory: true,
  })
)
export async function openRentalDocument(url: string) {
  const parsed = new URL(url)
  if (!['https:', 'http:'].includes(parsed.protocol))
    throw new Error('URL de documento inválida')
  await Linking.openURL(url)
}
