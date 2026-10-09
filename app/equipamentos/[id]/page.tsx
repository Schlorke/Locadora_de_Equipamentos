import { StructuredData } from '../../../packages/frontend/src/widgets/dados-estruturados'
import { getLocalBusinessData } from '../../../packages/frontend/src/entities/configuracao/model/local-business'
import {
  buildEquipmentBreadcrumbs,
  buildEquipmentProductStructuredData,
  buildEquipmentSeo,
} from '../../../packages/frontend/src/entities/equipamento/model/seo'

import { EquipamentoDetalhePage } from '@gb-locacoes/frontend/pages/equipamento-detalhe'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

// server-cache-react: deduplica fetch entre generateMetadata e page na mesma request
const getEquipmentForDetail = cache(async (id: string) => {
  const { prisma } = await import('@/lib/prisma')
  return prisma.equipment.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          iconColor: true,
          bgColor: true,
          fontColor: true,
          slug: true,
          customIcon: true,
        },
      },
    },
  })
})

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const equipment = await getEquipmentForDetail(params.id)

  if (!equipment) {
    return {
      title: 'Equipamento não encontrado | GB Locações',
      description:
        'O equipamento solicitado não foi encontrado. Confira nosso catálogo completo de equipamentos para locação.',
    }
  }

  const seo = buildEquipmentSeo(equipment, params.id)

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    authors: [{ name: 'GB Locações' }],
    creator: 'GB Locações',
    publisher: 'GB Locações',
    alternates: {
      canonical: seo.canonicalUrl,
    },
    openGraph: {
      title: seo.openGraphTitle,
      description: seo.openGraphDescription,
      url: seo.canonicalUrl,
      siteName: 'GB Locações',
      images: [
        {
          url: seo.imageUrl,
          width: 1200,
          height: 630,
          alt: seo.imageAlt,
          type: 'image/jpeg',
        },
      ],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.openGraphTitle,
      description: seo.openGraphDescription,
      images: [
        {
          url: seo.imageUrl,
          alt: seo.imageAlt,
        },
      ],
      creator: '@locacoesgb',
      site: '@locacoesgb',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

// Force dynamic rendering to avoid build-time database queries
export const dynamic = 'force-dynamic'

export default async function EquipmentDetailPage(props: Props) {
  const params = await props.params

  let equipment = null
  let settings = null

  try {
    // async-parallel: equipment (via cache) e settings em paralelo
    const [equipmentRes, settingsRes] = await Promise.all([
      getEquipmentForDetail(params.id),
      (async () => {
        const { prisma } = await import('@/lib/prisma')
        return prisma.setting.findFirst({
          select: {
            companyPhone: true,
            whatsappNumber: true,
            contactEmail: true,
            companyAddress: true,
            aboutUsText: true,
          },
        })
      })(),
    ])
    equipment = equipmentRes
    settings = settingsRes
  } catch (_error) {
    console.log('Database query failed (CI build or connection error)')
  }

  if (!equipment) {
    notFound()
  }

  // Gerar dados dinâmicos do LocalBusiness com os settings do banco
  const localBusinessData = getLocalBusinessData(settings || undefined)

  // Converter Decimal para number para cálculos
  const pricePerDay = Number(equipment.pricePerDay)
  const structuredDataProduct = buildEquipmentProductStructuredData(
    {
      id: equipment.id,
      name: equipment.name,
      description: equipment.description,
      images: equipment.images,
      available: equipment.available,
      pricePerDay,
      category: equipment.category,
    },
    params.id
  )
  const breadcrumbs = buildEquipmentBreadcrumbs(
    equipment,
    params.id,
    equipment.category?.slug
  )

  return (
    <EquipamentoDetalhePage
      name={equipment.name}
      description={equipment.description}
      categoryName={equipment.category.name}
      pricePerDay={pricePerDay}
      available={equipment.available}
      structuredData={
        <StructuredData
          localBusiness={localBusinessData}
          product={structuredDataProduct}
          breadcrumbs={breadcrumbs}
        />
      }
      categorySlug={equipment.category?.slug}
      images={equipment.images || []}
      categoryIcon={equipment.category.icon}
      categoryIconColor={equipment.category.iconColor}
      categoryBgColor={equipment.category.bgColor}
      categoryFontColor={equipment.category.fontColor}
      categoryCustomIcon={equipment.category.customIcon}
      equipmentId={equipment.id}
      dailyDiscount={equipment.dailyDiscount || 0}
      weeklyDiscount={equipment.weeklyDiscount || 0}
      biweeklyDiscount={equipment.biweeklyDiscount || 0}
      monthlyDiscount={equipment.monthlyDiscount || 0}
      popularPeriod={equipment.popularPeriod || 'weekly'}
      maxStock={equipment.maxStock || undefined}
      dailyDirectValue={Number(equipment.dailyDirectValue) || 0}
      weeklyDirectValue={Number(equipment.weeklyDirectValue) || 0}
      biweeklyDirectValue={Number(equipment.biweeklyDirectValue) || 0}
      monthlyDirectValue={Number(equipment.monthlyDirectValue) || 0}
      dailyUseDirectValue={equipment.dailyUseDirectValue || false}
      weeklyUseDirectValue={equipment.weeklyUseDirectValue || false}
      biweeklyUseDirectValue={equipment.biweeklyUseDirectValue || false}
      monthlyUseDirectValue={equipment.monthlyUseDirectValue || false}
      dailyRentalEnabled={equipment.dailyRentalEnabled ?? true}
      weeklyRentalEnabled={equipment.weeklyRentalEnabled ?? true}
      biweeklyRentalEnabled={equipment.biweeklyRentalEnabled ?? true}
      monthlyRentalEnabled={equipment.monthlyRentalEnabled ?? true}
    />
  )
}
