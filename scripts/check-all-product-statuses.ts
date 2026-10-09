// @ts-nocheck
/**
 * Script para verificar o status detalhado de TODOS os produtos no Google Merchant Center
 * Uso: npx tsx scripts/check-all-product-statuses.ts
 */
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Carregar .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const MERCHANT_ID = process.env.GOOGLE_MERCHANT_ID
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY

if (!MERCHANT_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  process.exit(1)
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/content'],
  })

  const authClient = await auth.getClient()
  const content = google.content('v2.1')

  console.log('📊 Status Detalhado de TODOS os Produtos\n')
  console.log('='.repeat(80))

  try {
    const statuses = await content.productstatuses.list({
      auth: authClient,
      merchantId: MERCHANT_ID,
      maxResults: 250, // Buscar todos
    })

    const resources = statuses.data.resources || []

    if (resources.length === 0) {
      console.log('⚠️  Nenhum produto encontrado')
      return
    }

    console.log(`\n✓ Total de produtos: ${resources.length}\n`)

    let approvedCount = 0
    let pendingCount = 0
    let disapprovedCount = 0

    resources.forEach((product: any, i: number) => {
      const title = product.title || 'Sem título'
      const productId = product.productId || 'N/A'

      console.log(`\n${i + 1}. ${title}`)
      console.log(`   ID: ${productId}`)

      // Verificar status de cada destino
      const destinations = product.destinationStatuses || []

      let hasApproved = false
      let hasPending = false
      let hasDisapproved = false

      destinations.forEach((dest: any) => {
        const status = dest.status || 'unknown'
        const destination = dest.destination || 'unknown'

        let icon = '❓'
        if (status === 'approved') {
          icon = '✅'
          hasApproved = true
        } else if (status === 'pending') {
          icon = '⏳'
          hasPending = true
        } else if (status === 'disapproved') {
          icon = '❌'
          hasDisapproved = true
        }

        console.log(`   ${icon} ${destination}: ${status}`)

        // Mostrar issues/problemas se houver
        if (dest.approvalStatus && dest.approvalStatus !== 'approved') {
          console.log(`      Approval Status: ${dest.approvalStatus}`)
        }
      })

      // Mostrar issues gerais do produto
      if (product.itemLevelIssues && product.itemLevelIssues.length > 0) {
        console.log('\n   ⚠️  PROBLEMAS ENCONTRADOS:')
        product.itemLevelIssues.forEach((issue: any) => {
          console.log(`      • ${issue.code}: ${issue.description}`)
          console.log(`        Severidade: ${issue.severity}`)
          if (issue.resolution) {
            console.log(`        Solução: ${issue.resolution}`)
          }
        })
      }

      // Contadores
      if (hasApproved && !hasPending && !hasDisapproved) {
        approvedCount++
      } else if (hasPending) {
        pendingCount++
      } else if (hasDisapproved) {
        disapprovedCount++
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log('\n📈 RESUMO:')
    console.log(`   ✅ Aprovados: ${approvedCount}`)
    console.log(`   ⏳ Pendentes: ${pendingCount}`)
    console.log(`   ❌ Reprovados: ${disapprovedCount}`)
    console.log(`   📦 Total: ${resources.length}`)

    if (pendingCount > 0) {
      console.log(
        '\n💡 Produtos pendentes podem levar até 24-48h para serem aprovados.'
      )
    }

    if (disapprovedCount > 0) {
      console.log(
        '\n⚠️  ATENÇÃO: Há produtos reprovados. Verifique os problemas acima.'
      )
    }
  } catch (error: any) {
    console.error(`\n❌ Erro ao buscar status: ${error.message}`)
    if (error.code) console.error(`   Code: ${error.code}`)
  }
}

main().catch(console.error)
