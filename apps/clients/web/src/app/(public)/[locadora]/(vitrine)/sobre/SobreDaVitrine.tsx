'use client'

import {
  Equipment3DCarousel,
  GoogleMerchantBadge,
  SobrePage,
  type SobreCarouselProps,
} from '@gb-locacoes/frontend/pages/sobre'

// Selo do Google Avaliações do Consumidor com o ID do Merchant Center da própria locadora (`siteContent`, onda 134):
// a página só mostra a seção com o ID e o nome dela. O `page.tsx` do segmento é de servidor só para os metadados da
// locadora (onda 135, A4).
export function SobreDaVitrine() {
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
