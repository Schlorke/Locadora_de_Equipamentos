// @ts-nocheck
/**
 * Script para deletar e re-inserir todos os produtos no Google Merchant Center
 * Necessário porque products.update não altera campos imutáveis como 'link'
 * Uso: npx tsx scripts/resync-products.ts
 */
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const MERCHANT_ID = process.env.GOOGLE_MERCHANT_ID!
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL!
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY!

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: SERVICE_ACCOUNT_EMAIL,
    private_key: SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/content'],
})

async function main() {
  const authClient = await auth.getClient()
  const content = google.content('v2.1')

  // 1. Listar e deletar todos os produtos existentes
  console.log('=== Passo 1: Deletando todos os produtos existentes ===\n')

  const existing = await content.products.list({
    auth: authClient,
    merchantId: MERCHANT_ID,
    maxResults: 250,
  })

  const products = existing.data.resources || []
  console.log(`Encontrados ${products.length} produtos para deletar\n`)

  for (const product of products) {
    try {
      await content.products.delete({
        auth: authClient,
        merchantId: MERCHANT_ID,
        productId: product.id!,
      })
      console.log(`  ✓ Deletado: ${product.title} (${product.offerId})`)
    } catch (e: any) {
      console.error(`  ✗ Erro ao deletar ${product.title}: ${e.message}`)
    }
  }

  console.log('\n=== Passo 2: Re-inserindo produtos com URLs corretas ===\n')

  // 2. Importar módulos do projeto e re-inserir
  const { createGoogleMerchantClient } =
    await import('./ops/google-merchant/client')
  const { equipmentToGoogleProduct } =
    await import('./ops/google-merchant/mapper')
  const { getDatabaseRuntime } = await import('@gb-locacoes/backend/runtime')
  const { prisma } = getDatabaseRuntime()

  const equipments = await prisma.equipment.findMany({
    where: { available: true },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Inserindo ${equipments.length} equipamentos...\n`)

  const client = createGoogleMerchantClient()
  let inserted = 0
  let errors = 0

  for (const equipment of equipments) {
    try {
      const googleProduct = equipmentToGoogleProduct(equipment)

      // Log do link para verificar
      if (inserted === 0) {
        console.log(`  Link de exemplo: ${googleProduct.link}`)
        console.log(`  Imagem de exemplo: ${googleProduct.imageLink}`)
        console.log()
      }

      await client.insertProduct(googleProduct)
      inserted++
      console.log(`  ✓ Inserido: ${equipment.name}`)
    } catch (e: any) {
      errors++
      console.error(`  ✗ Erro ao inserir ${equipment.name}: ${e.message}`)
    }
  }

  console.log(`\n=== Resultado ===`)
  console.log(`Inseridos: ${inserted}`)
  console.log(`Erros: ${errors}`)

  // 3. Verificar um produto
  console.log('\n=== Verificando primeiro produto inserido ===\n')
  try {
    const checkProducts = await content.products.list({
      auth: authClient,
      merchantId: MERCHANT_ID,
      maxResults: 1,
    })
    const first = checkProducts.data.resources?.[0]
    if (first) {
      console.log(`Título: ${first.title}`)
      console.log(`Link: ${first.link}`)
      console.log(`Imagem: ${first.imageLink}`)
      console.log(`identifierExists: ${first.identifierExists}`)
      console.log(`feedLabel: ${first.feedLabel}`)
    }
  } catch (e: any) {
    console.error(`Erro ao verificar: ${e.message}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
