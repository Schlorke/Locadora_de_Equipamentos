import { Image } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import {
  AdminFilterCard,
  CategoryBadge,
  EquipamentosPage,
} from '@gb-locacoes/frontend/pages/equipamentos'
import { Link, SmartPagination } from '@gb-locacoes/ui'
import { resolvePublicAssetUrl } from '../../host/api-config'
export default function EquipamentosScreen() {
  const params = useLocalSearchParams<{
    categoria?: string
    tenantSlug?: string
  }>()
  return (
    <EquipamentosPage
      categoria={params.categoria ?? null}
      tenantSlug={params.tenantSlug ?? null}
      image={({ src, alt, height }) => (
        <Image
          source={{ uri: resolvePublicAssetUrl(src) }}
          accessibilityLabel={alt}
          resizeMode="contain"
          style={{ width: '100%', height }}
        />
      )}
      link={({ href, children }) => <Link href={href}>{children}</Link>}
      filterCard={(props) => <AdminFilterCard {...props} />}
      pagination={(props) => <SmartPagination {...props} />}
      categoryBadge={(category) => (
        <CategoryBadge category={category} size="sm" hover={false} />
      )}
    />
  )
}
