import { Image } from 'react-native'
import { resolvePublicAssetUrl } from './api-config'
export function renderEquipmentImage({
  src,
  alt,
  height,
}: {
  src: string
  alt: string
  height: number
}) {
  return (
    <Image
      source={{ uri: resolvePublicAssetUrl(src) }}
      accessibilityLabel={alt}
      resizeMode="contain"
      style={{ width: '100%', height }}
    />
  )
}
