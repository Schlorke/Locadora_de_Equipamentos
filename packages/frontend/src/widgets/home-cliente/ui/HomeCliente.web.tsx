'use client'

import dynamic from 'next/dynamic'

const EquipmentShowcaseSection = dynamic(
  () => import('./Vitrine.web'),
  {
    ssr: false,
    loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
  }
)

const FeaturedMaterials = dynamic(() => import('./Destaques.web'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
})

export default function HomePageClient() {
  return (
    <>
      <EquipmentShowcaseSection />
      <FeaturedMaterials />
    </>
  )
}
