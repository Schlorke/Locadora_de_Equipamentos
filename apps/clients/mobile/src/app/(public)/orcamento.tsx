import { useCallback } from 'react'
import { Image } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { QuotePageWrapper } from '@gb-locacoes/frontend/pages/orcamento'
import { resolvePublicAssetUrl } from '../../host/api-config'

export default function QuoteScreen() {
  const router = useRouter(),
    params = useLocalSearchParams<{ equipmentId?: string }>()
  const clearQuery = useCallback(
    () => router.setParams({ equipmentId: undefined }),
    [router]
  )
  return (
    <QuotePageWrapper
      storage={AsyncStorage}
      equipmentId={params.equipmentId}
      clearQuery={clearQuery}
      image={({ src, alt, height }) => (
        <Image
          source={{ uri: resolvePublicAssetUrl(src) }}
          accessibilityLabel={alt}
          resizeMode="contain"
          style={{ width: '100%', height }}
        />
      )}
    />
  )
}
