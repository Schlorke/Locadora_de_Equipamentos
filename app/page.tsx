import {
  HomePage,
  buildHeroInitialSettings,
} from '@gb-locacoes/frontend/pages/home'
import { getLocalBusinessData } from '../packages/frontend/src/entities/configuracao'

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

export default async function Page() {
  const prisma = await getPrisma()

  let publicSettings = null
  try {
    publicSettings = await prisma.setting.findFirst({
      select: {
        companyPhone: true,
        whatsappNumber: true,
        contactEmail: true,
        companyAddress: true,
        heroCarousel: true,
        waveAnimation: true,
        aboutUsText: true,
        // Onda 134: anos de mercado e frota do hero vêm do conteúdo institucional da locadora.
        siteContent: true,
      },
    })
  } catch (_error) {
    // Ignorar erro durante build no CI
    console.log('Using default settings (database not available)')
  }

  const localBusiness = getLocalBusinessData(publicSettings || undefined)
  const heroInitialSettings = buildHeroInitialSettings({
    heroCarousel: publicSettings?.heroCarousel,
    waveAnimation: publicSettings?.waveAnimation,
    siteContent: publicSettings?.siteContent,
    companyPhone: publicSettings?.companyPhone,
    whatsappNumber: publicSettings?.whatsappNumber,
  })

  return (
    <HomePage
      localBusiness={localBusiness}
      heroInitialSettings={heroInitialSettings}
    />
  )
}
