// @ts-nocheck
/**
 * Script para verificar motivos de rejeição dos produtos no Google Merchant Center
 * Uso: npx tsx scripts/check-rejections.ts
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

  console.log(
    '=== Verificando Status dos Produtos no Google Merchant Center ===\n'
  )

  // 1. Listar produtos
  console.log('1. Produtos cadastrados via API:')
  try {
    const products = await content.products.list({
      auth: authClient,
      merchantId: MERCHANT_ID,
      maxResults: 50,
    })
    const items = products.data.resources || []
    console.log(`   Total: ${items.length} produto(s)\n`)
    items.forEach((p: any, i: number) => {
      console.log(`   ${i + 1}. ${p.title}`)
      console.log(`      offerId: ${p.offerId}`)
      console.log(
        `      channel: ${p.channel}, lang: ${p.contentLanguage}, country: ${p.targetCountry}`
      )
      console.log(
        `      availability: ${p.availability}, condition: ${p.condition}`
      )
      console.log(`      price: ${p.price?.value} ${p.price?.currency}`)
      console.log(`      identifierExists: ${p.identifierExists}`)
      console.log(`      feedLabel: ${p.feedLabel}`)
      console.log(`      customLabel0: ${p.customLabel0}`)
      console.log(`      link: ${p.link}`)
      console.log()
    })
  } catch (e: any) {
    console.error(`   Erro: ${e.message}\n`)
  }

  // 2. Product statuses (mostra rejeições)
  console.log('2. Status dos produtos (inclui motivos de rejeição):')
  try {
    const statuses = await content.productstatuses.list({
      auth: authClient,
      merchantId: MERCHANT_ID,
      maxResults: 50,
    })
    const items = statuses.data.resources || []
    console.log(`   Total com status: ${items.length}\n`)

    items.forEach((s: any, i: number) => {
      console.log(`   --- Produto ${i + 1}: ${s.title} ---`)
      console.log(`   ID: ${s.productId}`)

      // Destination statuses
      if (s.destinationStatuses) {
        s.destinationStatuses.forEach((d: any) => {
          console.log(
            `   Destino: ${d.destination} -> Aprovado: ${d.approvedCountries?.join(',') || 'NENHUM'} | Pendente: ${d.pendingCountries?.join(',') || 'NENHUM'} | Reprovado: ${d.disapprovedCountries?.join(',') || 'NENHUM'}`
          )
        })
      }

      // Item level issues
      if (s.itemLevelIssues && s.itemLevelIssues.length > 0) {
        console.log(`   PROBLEMAS (${s.itemLevelIssues.length}):`)
        s.itemLevelIssues.forEach((issue: any) => {
          console.log(`     ❌ [${issue.servability}] ${issue.description}`)
          console.log(`        Código: ${issue.code}`)
          console.log(`        Atributo: ${issue.attributeName || 'N/A'}`)
          if (issue.detail) console.log(`        Detalhe: ${issue.detail}`)
          if (issue.documentation)
            console.log(`        Doc: ${issue.documentation}`)
        })
      } else {
        console.log(`   ✓ Nenhum problema encontrado`)
      }
      console.log()
    })
  } catch (e: any) {
    console.error(`   Erro: ${e.message}\n`)
  }

  console.log('=== Verificação finalizada ===')
}

main().catch(console.error)
