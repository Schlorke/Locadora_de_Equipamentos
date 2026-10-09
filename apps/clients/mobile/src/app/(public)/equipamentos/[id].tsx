import { Image, Share } from 'react-native'
import * as Linking from 'expo-linking'
import { useLocalSearchParams } from 'expo-router'
import {
  EquipmentDetailScreen,
  buildSharePayload,
} from '@gb-locacoes/frontend/pages/equipamento-detalhe'
import { resolvePublicAssetUrl } from '../../../host/api-config'

export default function EquipmentScreen() {
  const params = useLocalSearchParams<{ id: string; tenantSlug?: string }>()
  return (
    <EquipmentDetailScreen
      id={params.id}
      tenantSlug={params.tenantSlug ?? null}
      image={({ src, alt, height }) => (
        <Image
          source={{ uri: resolvePublicAssetUrl(src) }}
          accessibilityLabel={alt}
          resizeMode="contain"
          style={{ width: '100%', height }}
        />
      )}
      onShare={async (name) => {
        const url = Linking.createURL(
          `/equipamentos/${encodeURIComponent(params.id)}`,
          {
            queryParams: params.tenantSlug
              ? { tenantSlug: params.tenantSlug }
              : undefined,
          }
        )
        const data = buildSharePayload(name, url)
        await Share.share({
          title: data.title,
          message: `${data.text}\n${data.url}`,
          url: data.url,
        })
      }}
    />
  )
}
