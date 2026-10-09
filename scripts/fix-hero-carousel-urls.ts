/**
 * Script para atualizar URLs do heroCarousel no Settings
 *
 * Este script atualiza as URLs antigas (.jpg/.png) para as novas (.webp)
 * no campo heroCarousel da tabela Setting.
 *
 * Uso:
 *   pnpm tsx scripts/fix-hero-carousel-urls.ts
 */

import 'dotenv/config'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()

async function fixHeroCarouselUrls() {
  try {
    console.log('🔧 Atualizando URLs do heroCarousel...\n')

    // Buscar configurações
    const settings = await prisma.setting.findMany({
      select: { id: true, heroCarousel: true },
    })

    if (settings.length === 0) {
      console.log('✅ Nenhuma configuração encontrada')
      return
    }

    let totalUpdated = 0

    for (const setting of settings) {
      if (!setting.heroCarousel) continue

      let heroCarousel = setting.heroCarousel
      if (typeof heroCarousel !== 'object' || !Array.isArray(heroCarousel)) {
        continue
      }

      let hasUpdated = false
      const updatedHeroCarousel = heroCarousel.map((item: unknown) => {
        // item pode ser string (URL) ou objeto { imageUrl: string, ... }
        if (typeof item === 'string') {
          // Substituir .jpg/.jpeg/.png por .webp
          const oldUrl = item
          if (
            oldUrl.endsWith('.jpg') ||
            oldUrl.endsWith('.jpeg') ||
            oldUrl.endsWith('.png')
          ) {
            const newUrl = oldUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp')
            hasUpdated = true
            console.log(`  ✅ ${oldUrl} → ${newUrl}`)
            return newUrl
          }
          return item
        }

        if (typeof item === 'object' && item !== null && 'imageUrl' in item) {
          const itemObj = item as { imageUrl: string; [key: string]: unknown }
          const oldUrl = itemObj.imageUrl
          if (
            oldUrl.endsWith('.jpg') ||
            oldUrl.endsWith('.jpeg') ||
            oldUrl.endsWith('.png')
          ) {
            const newUrl = oldUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp')
            hasUpdated = true
            console.log(`  ✅ ${oldUrl} → ${newUrl}`)
            return { ...itemObj, imageUrl: newUrl }
          }
          return item
        }

        return item
      })

      if (hasUpdated) {
        await prisma.setting.update({
          where: { id: setting.id },
          data: { heroCarousel: updatedHeroCarousel as any },
        })
        totalUpdated++
        console.log(`✅ Configuração ${setting.id} atualizada\n`)
      }
    }

    console.log(`\n📊 Estatísticas:`)
    console.log(`   Configurações atualizadas: ${totalUpdated}`)
    console.log(`\n✅ Concluído!`)
  } catch (error) {
    console.error('\n❌ Erro:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
fixHeroCarouselUrls().catch((error) => {
  console.error('Erro não tratado:', error)
  process.exit(1)
})
