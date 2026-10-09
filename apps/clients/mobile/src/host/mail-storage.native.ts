import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import { shareDownloadedContract } from './contract-share'
export const mailDevice = {
  async readHighlighted(key: string) {
    try {
      const value = JSON.parse(
        (await AsyncStorage.getItem('mail-highlighted:' + key)) || '[]'
      )
      return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : []
    } catch {
      return []
    }
  },
  persistHighlighted(key: string, keys: string[]) {
    void AsyncStorage.setItem(
      'mail-highlighted:' + key,
      JSON.stringify(keys)
    ).catch(() => {})
  },
  uuid: randomUUID,
  download: (blob: Blob, name: string, isCurrent: () => boolean) =>
    shareDownloadedContract({
      blob,
      name,
      isCurrent,
      dialogTitle: 'Baixar Anexo',
      fallbackMimeType: 'application/octet-stream',
    }),
}
