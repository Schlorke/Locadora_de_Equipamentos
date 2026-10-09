import { config } from 'dotenv'
import { resolve } from 'path'

// Carregar variáveis de ambiente
config({ path: resolve(process.cwd(), '.env.local') })

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()

async function checkRentalDates() {
  try {
    // Buscar os rental_items mais recentes (criados em 2026)
    const recentItems = await prisma.rental_items.findMany({
      where: {
        createdat: {
          gte: new Date('2026-01-01'),
        },
      },
      orderBy: {
        createdat: 'desc',
      },
      take: 3,
      select: {
        id: true,
        rentalid: true,
        totaldays: true,
        startDate: true,
        endDate: true,
        includeWeekends: true,
        createdat: true,
      },
    })

    console.log('\n='.repeat(60))
    console.log('📋 VERIFICAÇÃO DE DATAS INDIVIDUAIS - RENTAL_ITEMS')
    console.log('='.repeat(60))

    if (recentItems.length === 0) {
      console.log('\n❌ NENHUM rental_item de 2026 encontrado!')
      console.log('A conversão pode não ter ocorrido.')
      return
    }

    console.log(`\n✅ Encontrados ${recentItems.length} rental_items de 2026\n`)

    let allDatesValid = true

    recentItems.forEach((item, index) => {
      console.log(`Item ${index + 1}:`)
      console.log(`  ID: ${item.id}`)
      console.log(`  Rental ID: ${item.rentalid}`)
      console.log(`  Total Days: ${item.totaldays}`)
      console.log(
        `  Start Date: ${item.startDate ? item.startDate.toISOString().split('T')[0] : '❌ NULL'}`
      )
      console.log(
        `  End Date: ${item.endDate ? item.endDate.toISOString().split('T')[0] : '❌ NULL'}`
      )
      console.log(`  Include Weekends: ${item.includeWeekends}`)
      console.log(
        `  Criado em: ${item.createdat?.toISOString().split('T')[0] || 'N/A'}`
      )

      if (!item.startDate || !item.endDate) {
        allDatesValid = false
        console.log('  ❌ FALHOU: Datas estão NULL')
      } else {
        console.log('  ✅ PASSOU: Datas preenchidas')
      }

      console.log('')
    })

    // Verificar a rental correspondente
    if (recentItems.length > 0) {
      const rentalId = recentItems[0]!.rentalid
      const rental = await prisma.rentals.findUnique({
        where: { id: rentalId },
        select: {
          id: true,
          startdate: true,
          enddate: true,
          createdat: true,
        },
      })

      if (rental) {
        console.log('📊 RENTAL GLOBAL:')
        console.log(`  ID: ${rental.id}`)
        console.log(
          `  Start Date: ${rental.startdate?.toISOString().split('T')[0] || 'NULL'}`
        )
        console.log(
          `  End Date: ${rental.enddate?.toISOString().split('T')[0] || 'NULL'}`
        )
        console.log('')

        // Calcular MIN/MAX esperado
        const itemDates = recentItems
          .filter((i) => i.rentalid === rentalId)
          .map((i) => ({
            start: i.startDate,
            end: i.endDate,
          }))

        const minDate = itemDates
          .map((d) => d.start)
          .filter((d): d is Date => d !== null)
          .reduce((min, d) => (d < min ? d : min), new Date('9999-12-31'))
        const maxDate = itemDates
          .map((d) => d.end)
          .filter((d): d is Date => d !== null)
          .reduce((max, d) => (d > max ? d : max), new Date('1900-01-01'))

        const expectedStart = minDate.toISOString().split('T')[0]
        const expectedEnd = maxDate.toISOString().split('T')[0]
        const actualStart = rental.startdate?.toISOString().split('T')[0]
        const actualEnd = rental.enddate?.toISOString().split('T')[0]

        console.log('📊 VERIFICAÇÃO DE DATAS GLOBAIS:')
        console.log(`  Start Date esperado (MIN): ${expectedStart}`)
        console.log(`  Start Date atual: ${actualStart}`)
        console.log(
          expectedStart === actualStart
            ? '  ✅ Start Date CORRETO'
            : '  ❌ Start Date INCORRETO'
        )
        console.log(`  End Date esperado (MAX): ${expectedEnd}`)
        console.log(`  End Date atual: ${actualEnd}`)
        console.log(
          expectedEnd === actualEnd
            ? '  ✅ End Date CORRETO'
            : '  ❌ End Date INCORRETO'
        )
        console.log('')
      }
    }

    console.log('='.repeat(60))
    if (allDatesValid) {
      console.log('🎉 TESTE PASSOU! Datas individuais foram preservadas!')
    } else {
      console.log('❌ TESTE FALHOU! Datas individuais estão NULL!')
    }
    console.log('='.repeat(60))
  } catch (error) {
    console.error('Erro ao verificar datas:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkRentalDates()
