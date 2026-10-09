/**
 * Script auxiliar para testes do sistema de orçamentos
 *
 * Uso:
 * npx tsx scripts/test-quote-system.ts [comando]
 *
 * Comandos disponíveis:
 * - security: Testa vulnerabilidade de autorização
 * - dates: Cria orçamento com datas diferentes
 * - pagination: Verifica metadados de paginação
 * - rate-limit: Testa rate limiting
 * - all: Executa todos os testes
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Carregar variáveis de ambiente
config({ path: resolve(process.cwd(), '.env.local') })

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()
import Decimal from 'decimal.js'

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function section(title: string) {
  console.log('\n' + '='.repeat(60))
  log('cyan', `📋 ${title}`)
  console.log('='.repeat(60))
}

function success(message: string) {
  log('green', `✅ ${message}`)
}

function error(message: string) {
  log('red', `❌ ${message}`)
}

function info(message: string) {
  log('blue', `ℹ️  ${message}`)
}

function warning(message: string) {
  log('yellow', `⚠️  ${message}`)
}

/**
 * Teste 1: Verificar que userId não é aceito na query string
 */
async function testSecurityVulnerability() {
  section('TESTE DE SEGURANÇA - Vulnerabilidade Corrigida')

  try {
    // Buscar dois usuários diferentes
    const users = await prisma.user.findMany({
      take: 2,
      select: { id: true, email: true },
    })

    if (users.length < 2) {
      warning('Não há usuários suficientes para teste. Criando...')
      // Criar usuários de teste seria necessário aqui
      return
    }

    info(`Usuário 1: ${users[0].email} (${users[0].id})`)
    info(`Usuário 2: ${users[1].email} (${users[1].id})`)

    // Verificar se API /api/quotes aceita userId
    info('\n📍 Para testar manualmente:')
    info('1. Faça login como usuário 1')
    info('2. No console do navegador, execute:')
    console.log(`
fetch('/api/quotes?userId=${users[1].id}')
  .then(r => r.json())
  .then(data => {
    console.log('Orçamentos retornados:', data.length)
    console.log('userId retornado:', data[0]?.userId)
    if (data.some(q => q.userId === '${users[1].id}')) {
      console.log('❌ FALHOU: Retornou orçamentos de outro usuário!')
    } else {
      console.log('✅ PASSOU: Ignorou userId da query string!')
    }
  })
    `)

    success('Instruções exibidas. Execute o código no navegador.')
  } catch (err) {
    error(`Erro no teste de segurança: ${err}`)
  }
}

/**
 * Teste 2: Criar orçamento com datas individuais diferentes
 */
async function testIndividualDates() {
  section('TESTE DE DATAS INDIVIDUAIS')

  try {
    // Buscar equipamentos para teste
    const equipments = await prisma.equipment.findMany({
      take: 3,
      select: { id: true, name: true },
    })

    if (equipments.length < 3) {
      error('Não há equipamentos suficientes. Crie ao menos 3 equipamentos.')
      return
    }

    info('Equipamentos disponíveis:')
    equipments.forEach((eq, i) => {
      info(`  ${i + 1}. ${eq.name} (${eq.id})`)
    })

    // Criar orçamento de teste
    const quote = await prisma.quote.create({
      data: {
        name: 'Cliente Teste Datas Individuais',
        email: `teste-datas-${Date.now()}@example.com`,
        phone: '11999999999',
        company: 'Empresa Teste Ltda',
        total: new Decimal(1500),
        status: 'PENDING',
        items: {
          create: [
            {
              equipmentId: equipments[0].id,
              quantity: 1,
              days: 5,
              pricePerDay: new Decimal(100),
              total: new Decimal(500),
              startDate: new Date('2026-03-01'),
              endDate: new Date('2026-03-06'),
              includeWeekends: true,
            },
            {
              equipmentId: equipments[1].id,
              quantity: 2,
              days: 10,
              pricePerDay: new Decimal(50),
              total: new Decimal(1000),
              startDate: new Date('2026-03-01'),
              endDate: new Date('2026-03-11'),
              includeWeekends: false,
            },
            {
              equipmentId: equipments[2].id,
              quantity: 1,
              days: 7,
              pricePerDay: new Decimal(70),
              total: new Decimal(490),
              startDate: new Date('2026-03-05'),
              endDate: new Date('2026-03-12'),
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

    success(`Orçamento criado: ${quote.id}`)
    info(`Código: ${quote.quoteCode || 'N/A'}`)
    info('\nItens criados:')

    quote.items.forEach((item, i) => {
      info(`  ${i + 1}. ${item.equipment.name}`)
      info(`     Período: ${item.days} dias`)
      info(
        `     Start: ${item.startDate?.toISOString().split('T')[0] || 'N/A'}`
      )
      info(`     End: ${item.endDate?.toISOString().split('T')[0] || 'N/A'}`)
      info(`     Weekends: ${item.includeWeekends}`)
    })

    info('\n📍 Próximos passos:')
    info('1. Acesse: http://localhost:3000/admin/orcamentos')
    info(`2. Localize o orçamento "${quote.name}"`)
    info('3. Aprove o orçamento (será convertido para Rental)')
    info('4. Verifique no Prisma Studio (npx prisma studio):')
    info('   - Tabela rental_items deve ter startDate e endDate de cada item')
    info('   - Tabela rentals deve ter startdate = 2026-03-01 (MIN)')
    info('   - Tabela rentals deve ter enddate = 2026-03-12 (MAX)')

    success('\nOrçamento de teste criado com sucesso!')
  } catch (err) {
    error(`Erro ao criar orçamento de teste: ${err}`)
  }
}

/**
 * Teste 3: Verificar estrutura de paginação
 */
async function testPagination() {
  section('TESTE DE PAGINAÇÃO')

  try {
    const totalQuotes = await prisma.quote.count()
    info(`Total de orçamentos no banco: ${totalQuotes}`)

    if (totalQuotes < 25) {
      warning('Há menos de 25 orçamentos. Criando dados de teste...')

      const equipment = await prisma.equipment.findFirst()
      if (!equipment) {
        error('Nenhum equipamento encontrado. Crie ao menos 1 equipamento.')
        return
      }

      const toCreate = 25 - totalQuotes
      info(`Criando ${toCreate} orçamentos de teste...`)

      for (let i = 0; i < toCreate; i++) {
        await prisma.quote.create({
          data: {
            name: `Cliente Teste Paginação ${i + 1}`,
            email: `paginacao-${i + 1}-${Date.now()}@example.com`,
            phone: '11999999999',
            total: new Decimal(Math.random() * 1000 + 100),
            status: 'PENDING',
            items: {
              create: {
                equipmentId: equipment.id,
                quantity: 1,
                days: Math.floor(Math.random() * 10) + 1,
                pricePerDay: new Decimal(100),
                total: new Decimal(100),
              },
            },
          },
        })
      }

      success(`${toCreate} orçamentos criados!`)
    }

    const newTotal = await prisma.quote.count()
    success(`Total atual: ${newTotal} orçamentos`)

    info('\n📍 Para testar paginação:')
    info('1. Acesse: http://localhost:3000/admin/orcamentos')
    info('2. Abra DevTools (F12) → Network')
    info('3. Filtre por "quotes"')
    info('4. Recarregue a página')
    info('5. Verifique a requisição:')
    info('   - URL deve conter: ?page=1&limit=20')
    info(
      '   - Response deve ter: { quotes: [...], total: N, page: 1, limit: 20 }'
    )
    info('   - Array quotes deve ter no máximo 20 itens')
    info('6. Clique em "Próxima página" e veja nova requisição com page=2')

    success('\nDados de paginação preparados!')
  } catch (err) {
    error(`Erro no teste de paginação: ${err}`)
  }
}

/**
 * Teste 4: Informações sobre rate limiting
 */
async function testRateLimit() {
  section('TESTE DE RATE LIMITING')

  info('Rate limiting está ativo nas seguintes rotas:')
  info('')
  info('1. POST /api/quotes - 10 requisições/minuto')
  info('2. POST /api/admin/quotes/[id]/generate-boleto - 10 req/min')
  info('3. POST /api/admin/quotes/[id]/send-boleto - 10 req/min')
  info('4. PATCH /api/admin/quotes/[id] - 200 req/min')
  info('')
  info('📍 Para testar no navegador (DevTools Console):')

  console.log(`
// Teste 1: POST /api/quotes
async function testQuotesRateLimit() {
  for (let i = 1; i <= 12; i++) {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        email: 'test@test.com',
        phone: '11999999999',
        items: []
      })
    })
    console.log(\`\${i}: Status \${res.status}\`)
    if (res.status === 429) {
      console.log('✅ Rate limit funcionando!')
      break
    }
  }
}

testQuotesRateLimit()
  `)

  success('\nCole o código acima no console do navegador para testar!')
}

/**
 * Teste completo
 */
async function runAllTests() {
  log('cyan', '\n' + '='.repeat(60))
  log('cyan', '🧪 EXECUTANDO TODOS OS TESTES DO SISTEMA DE ORÇAMENTOS')
  log('cyan', '='.repeat(60))

  await testSecurityVulnerability()
  await testIndividualDates()
  await testPagination()
  await testRateLimit()

  section('RESUMO')
  success('Todos os testes executados!')
  info('\nVerifique os resultados acima e siga as instruções.')
  info('Consulte: docs/testing/quote-system-validation.md')
}

/**
 * Main
 */
async function main() {
  const command = process.argv[2] || 'help'

  try {
    switch (command) {
      case 'security':
        await testSecurityVulnerability()
        break
      case 'dates':
        await testIndividualDates()
        break
      case 'pagination':
        await testPagination()
        break
      case 'rate-limit':
        await testRateLimit()
        break
      case 'all':
        await runAllTests()
        break
      default:
        log('cyan', '\n📋 Script de Testes - Sistema de Orçamentos')
        info('\nUso: npx tsx scripts/test-quote-system.ts [comando]')
        info('\nComandos disponíveis:')
        info('  security     - Testa vulnerabilidade de autorização')
        info('  dates        - Cria orçamento com datas individuais')
        info('  pagination   - Prepara dados para teste de paginação')
        info('  rate-limit   - Exibe instruções de teste de rate limiting')
        info('  all          - Executa todos os testes')
        info('\nExemplo:')
        info('  npx tsx scripts/test-quote-system.ts dates')
    }
  } catch (err) {
    error(`\nErro fatal: ${err}`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
