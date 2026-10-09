'use client'

import {
  Equipment3DCarousel,
  GoogleMerchantBadge,
  SobrePage,
  type SobreCarouselProps,
} from '@gb-locacoes/frontend/pages/sobre'

export default function Page() {
  return (
    <SobrePage
      carousel={(props: SobreCarouselProps) => (
        <Equipment3DCarousel
          models={props.models}
          autoRotate={props.autoRotate}
          autoRotateInterval={props.autoRotateInterval}
          className={props.className}
          height={props.height}
          isRevealComplete={props.isRevealComplete}
        />
      )}
      badge={(merchantId: string) => (
        <GoogleMerchantBadge
          merchantId={merchantId}
          position="INLINE"
          region="BR"
        />
      )}
    />
  )
}
