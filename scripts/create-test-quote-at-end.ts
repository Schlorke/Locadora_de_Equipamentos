import { config } from 'dotenv'
import { resolve } from 'path'

// Carregar variáveis de ambiente
config({ path: resolve(process.cwd(), '.env.local') })

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()
import Decimal from 'decimal.js'

async function createTestQuote() {
  try {
    console.log('\n' + '='.repeat(60))
    console.log('🔧 CRIANDO ORÇAMENTO DE TESTE COM AT_END')
    console.log('='.repeat(60))

    // Buscar equipamentos
    const equipments = await prisma.equipment.findMany({
      take: 3,
      select: { id: true, name: true, pricePerDay: true },
    })

    if (equipments.length < 3) {
      console.log('❌ Erro: Precisamos de pelo menos 3 equipamentos')
      return
    }

    console.log('\n📦 Equipamentos selecionados:')
    equipments.forEach((eq, i) => {
      console.log(`  ${i + 1}. ${eq.name} - R$ ${eq.pricePerDay}/dia`)
    })

    // Criar orçamento com AT_END
    const quote = await prisma.quote.create({
      data: {
        name: 'TESTE AT_END - Datas Individuais',
        email: `teste-at-end-${Date.now()}@example.com`,
        phone: '11999999999',
        company: 'Empresa Teste AT_END Ltda',
        total: new Decimal(2490), // Será calculado pelos itens
        paymentTerms: 'AT_END', // 🎯 Conversão automática ao aprovar
        status: 'PENDING',
        items: {
          create: [
            {
              equipmentId: equipments[0]!.id,
              quantity: 1,
              days: 5,
              pricePerDay: new Decimal(equipments[0]!.pricePerDay),
              total: new Decimal(equipments[0]!.pricePerDay).mul(5),
              startDate: new Date('2026-03-10'),
              endDate: new Date('2026-03-15'),
              includeWeekends: true,
            },
            {
              equipmentId: equipments[1]!.id,
              quantity: 2,
              days: 10,
              pricePerDay: new Decimal(equipments[1]!.pricePerDay),
              total: new Decimal(equipments[1]!.pricePerDay).mul(10).mul(2),
              startDate: new Date('2026-03-10'),
              endDate: new Date('2026-03-20'),
              includeWeekends: false,
            },
            {
              equipmentId: equipments[2]!.id,
              quantity: 1,
              days: 7,
              pricePerDay: new Decimal(equipments[2]!.pricePerDay),
              total: new Decimal(equipments[2]!.pricePerDay).mul(7),
              startDate: new Date('2026-03-15'),
              endDate: new Date('2026-03-22'),
              includeWeekends: true,
            },
          ],
        },
      },
      include: {
        items: {
          include: {
            equipment: true,
          },
        },
      },
    })

    console.log('\n✅ ORÇAMENTO CRIADO COM SUCESSO!')
    console.log(`  ID: ${quote.id}`)
    console.log(`  Código: ${quote.quoteCode || 'Será gerado'}`)
    console.log(`  Nome: ${quote.name}`)
    console.log(`  Payment Terms: ${quote.paymentTerms} 🎯`)
    console.log(`  Status: ${quote.status}`)

    console.log('\n📋 ITENS COM DATAS INDIVIDUAIS:')
    quote.items.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.equipment.name}`)
      console.log(`     Período: ${item.days} dias`)
      console.log(
        `     De: ${item.startDate?.toISOString().split('T')[0]} até ${item.endDate?.toISOString().split('T')[0]}`
      )
      console.log(`     Weekends: ${item.includeWeekends ? 'SIM' : 'NÃO'}`)
      console.log(`     Total: R$ ${Number(item.total).toFixed(2)}`)
    })

    console.log('\n' + '='.repeat(60))
    console.log('📍 PRÓXIMOS PASSOS:')
    console.log('='.repeat(60))
    console.log('1. Acesse: http://localhost:3000/admin/orcamentos')
    console.log(`2. Localize o orçamento: "${quote.name}"`)
    console.log('3. Clique em "Aprovar"')
    console.log('4. ✨ Conversão para Rental acontecerá AUTOMATICAMENTE')
    console.log('5. Verifique no Prisma Studio que rental_items tem as datas')
    console.log('')
    console.log('🔍 Para verificar após aprovação:')
    console.log('   npx tsx scripts/verify-quote-conversion.ts')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n❌ Erro ao criar orçamento:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestQuote()
