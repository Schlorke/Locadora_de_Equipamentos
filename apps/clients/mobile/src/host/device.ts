import * as Clipboard from 'expo-clipboard'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import type { DeviceActions } from '@gb-locacoes/frontend/app'
export const deviceActions: DeviceActions = {
  async copyText(value) {
    await Clipboard.setStringAsync(value)
  },
  async pickSvgFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/svg+xml', 'text/xml', 'application/xml'],
      multiple: false,
      copyToCacheDirectory: true,
    })
    if (result.canceled) return null
    const asset = result.assets[0]
    if (!asset) return null
    const file = new File(asset.uri),
      size = asset.size ?? file.size
    if (size > 64 * 1024) throw new Error('Use um arquivo SVG com até 64kb.')
    return {
      name: asset.name,
      type: asset.mimeType ?? 'image/svg+xml',
      size,
      text: await file.text(),
    }
  },
}
