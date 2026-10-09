import { config } from 'dotenv'
import { resolve } from 'path'

// Carregar variáveis de ambiente
config({ path: resolve(process.cwd(), '.env.local') })

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()

async function verifyQuoteConversion() {
  try {
    console.log('\n='.repeat(60))
    console.log('🔍 VERIFICAÇÃO DE CONVERSÃO DE ORÇAMENTO')
    console.log('='.repeat(60))

    // Buscar o orçamento mais recente com "TESTE FINAL"
    const quote = await prisma.quote.findFirst({
      where: {
        name: {
          contains: 'TESTE FINAL',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        quoteCode: true,
        name: true,
        status: true,
        approvedAt: true,
        approvedBy: true,
        convertedToRentalId: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            equipmentId: true,
            days: true,
            startDate: true,
            endDate: true,
            includeWeekends: true,
          },
        },
      },
    })

    if (!quote) {
      console.log('\n❌ Nenhum orçamento "TESTE FINAL" encontrado')
      return
    }

    console.log('\n📋 ORÇAMENTO ENCONTRADO:')
    console.log(`  ID: ${quote.id}`)
    console.log(`  Código: ${quote.quoteCode}`)
    console.log(`  Nome: ${quote.name}`)
    console.log(`  Status: ${quote.status}`)
    console.log(
      `  Aprovado em: ${quote.approvedAt ? quote.approvedAt.toISOString() : 'NÃO APROVADO'}`
    )
    console.log(`  Aprovado por: ${quote.approvedBy || 'N/A'}`)
    console.log(
      `  Convertido para Rental: ${quote.convertedToRentalId ? '✅ SIM' : '❌ NÃO'}`
    )
    if (quote.convertedToRentalId) {
      console.log(`  Rental ID: ${quote.convertedToRentalId}`)
    }
    console.log(`  Criado em: ${quote.createdAt.toISOString()}`)
    console.log(`  Atualizado em: ${quote.updatedAt?.toISOString() || 'N/A'}`)

    console.log('\n📦 ITENS DO ORÇAMENTO:')
    quote.items.forEach((item, index) => {
      console.log(`  Item ${index + 1}:`)
      console.log(`    Equipment ID: ${item.equipmentId}`)
      console.log(`    Dias: ${item.days}`)
      console.log(
        `    Start Date: ${item.startDate ? item.startDate.toISOString().split('T')[0] : '❌ NULL'}`
      )
      console.log(
        `    End Date: ${item.endDate ? item.endDate.toISOString().split('T')[0] : '❌ NULL'}`
      )
      console.log(`    Include Weekends: ${item.includeWeekends}`)
    })

    // Se foi convertido, verificar o rental
    if (quote.convertedToRentalId) {
      console.log('\n🔄 VERIFICANDO RENTAL CRIADO:')

      const rental = await prisma.rentals.findUnique({
        where: { id: quote.convertedToRentalId },
        select: {
          id: true,
          startdate: true,
          enddate: true,
          status: true,
          createdat: true,
          rental_items: {
            select: {
              id: true,
              equipmentid: true,
              totaldays: true,
              startDate: true,
              endDate: true,
              includeWeekends: true,
            },
          },
        },
      })

      if (!rental) {
        console.log('  ❌ ERRO: Rental não encontrado!')
      } else {
        console.log(`  ID: ${rental.id}`)
        console.log(
          `  Start Date Global: ${rental.startdate?.toISOString().split('T')[0] || 'NULL'}`
        )
        console.log(
          `  End Date Global: ${rental.enddate?.toISOString().split('T')[0] || 'NULL'}`
        )
        console.log(`  Status: ${rental.status}`)
        console.log(`  Criado em: ${rental.createdat?.toISOString() || 'N/A'}`)

        console.log('\n  📦 RENTAL ITEMS:')
        rental.rental_items.forEach((item, index) => {
          console.log(`    Item ${index + 1}:`)
          console.log(`      Equipment ID: ${item.equipmentid}`)
          console.log(`      Total Days: ${item.totaldays}`)
          console.log(
            `      Start Date: ${item.startDate ? item.startDate.toISOString().split('T')[0] : '❌ NULL'}`
          )
          console.log(
            `      End Date: ${item.endDate ? item.endDate.toISOString().split('T')[0] : '❌ NULL'}`
          )
          console.log(`      Include Weekends: ${item.includeWeekends}`)
        })

        console.log('\n✅ VERIFICAÇÃO DE PRESERVAÇÃO DE DATAS:')
        let allDatesPreserved = true
        quote.items.forEach((quoteItem, index) => {
          const rentalItem = rental.rental_items[index]
          if (!rentalItem) {
            console.log(`  ❌ Item ${index + 1}: Rental item não encontrado`)
            allDatesPreserved = false
            return
          }

          const quoteStart = quoteItem.startDate?.toISOString().split('T')[0]
          const rentalStart = rentalItem.startDate?.toISOString().split('T')[0]
          const quoteEnd = quoteItem.endDate?.toISOString().split('T')[0]
          const rentalEnd = rentalItem.endDate?.toISOString().split('T')[0]

          const startMatch = quoteStart === rentalStart
          const endMatch = quoteEnd === rentalEnd

          console.log(
            `  Item ${index + 1}: ${startMatch && endMatch ? '✅' : '❌'}`
          )
          console.log(`    Quote:  ${quoteStart} → ${quoteEnd}`)
          console.log(`    Rental: ${rentalStart} → ${rentalEnd}`)

          if (!startMatch || !endMatch) {
            allDatesPreserved = false
          }
        })

        console.log('\n' + '='.repeat(60))
        if (allDatesPreserved) {
          console.log(
            '🎉 SUCESSO! Todas as datas individuais foram preservadas!'
          )
        } else {
          console.log('❌ FALHA! Algumas datas não foram preservadas!')
        }
        console.log('='.repeat(60))
      }
    } else {
      console.log('\n⚠️  ORÇAMENTO NÃO FOI CONVERTIDO PARA RENTAL')
      console.log('Possíveis causas:')
      console.log('  1. Erro na conversão (verificar logs do servidor)')
      console.log('  2. Conexão com banco de dados instável')
      console.log('  3. Erro não tratado no código de conversão')
    }
  } catch (error) {
    console.error('\n❌ Erro ao verificar conversão:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyQuoteConversion()
