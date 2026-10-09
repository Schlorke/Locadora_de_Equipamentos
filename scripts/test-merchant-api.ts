// @ts-nocheck
/**
 * Script de teste para verificar a conexão com Google Merchant Center API
 * Uso: npx tsx scripts/test-merchant-api.ts
 */
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Carregar .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const MERCHANT_ID = process.env.GOOGLE_MERCHANT_ID
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY

console.log('=== Teste de Conexão Google Merchant Center API ===\n')

// 1. Verificar variáveis de ambiente
console.log('1. Verificando variáveis de ambiente...')
console.log(
  `   GOOGLE_MERCHANT_ID: ${MERCHANT_ID ? `✓ (${MERCHANT_ID})` : '✗ NÃO CONFIGURADO'}`
)
console.log(
  `   SERVICE_ACCOUNT_EMAIL: ${SERVICE_ACCOUNT_EMAIL ? `✓ (${SERVICE_ACCOUNT_EMAIL})` : '✗ NÃO CONFIGURADO'}`
)
console.log(
  `   SERVICE_ACCOUNT_KEY: ${SERVICE_ACCOUNT_KEY ? `✓ (${SERVICE_ACCOUNT_KEY.substring(0, 30)}...)` : '✗ NÃO CONFIGURADO'}`
)
console.log()

if (!MERCHANT_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  process.exit(1)
}

async function main() {
  // 2. Testar autenticação
  console.log('2. Testando autenticação com Service Account...')
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: SERVICE_ACCOUNT_EMAIL,
        private_key: SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/content'],
    })

    const authClient = await auth.getClient()
    console.log('   ✓ Autenticação OK - Token obtido com sucesso\n')

    const content = google.content('v2.1')

    // 3. Testar acesso à conta
    console.log('3. Testando acesso à conta do Merchant Center...')
    try {
      const accountInfo = await content.accounts.get({
        auth: authClient,
        merchantId: MERCHANT_ID,
        accountId: MERCHANT_ID,
      })
      console.log(`   ✓ Conta OK - Nome: ${accountInfo.data.name}`)
      console.log(
        `   Website: ${accountInfo.data.websiteUrl || 'Não configurado'}`
      )
      console.log()
    } catch (accountError: any) {
      console.error(`   ✗ Erro ao acessar conta: ${accountError.message}`)
      if (accountError.code) console.error(`     Code: ${accountError.code}`)
      console.log()
    }

    // 4. Testar listagem de produtos
    console.log('4. Testando listagem de produtos via Content API v2.1...')
    try {
      const response = await content.products.list({
        auth: authClient,
        merchantId: MERCHANT_ID,
        maxResults: 10,
      })

      const products = response.data.resources || []
      console.log(
        `   ✓ Listagem OK - ${products.length} produto(s) encontrado(s) via API`
      )

      if (products.length > 0) {
        console.log('\n   Produtos encontrados:')
        products.forEach((p: any, i: number) => {
          console.log(
            `   ${i + 1}. ${p.title} (offerId: ${p.offerId}, status: ${p.availability})`
          )
        })
      } else {
        console.log(
          '   ℹ Nenhum produto via API - sync nunca foi executado ou falhou'
        )
      }
      console.log()
    } catch (listError: any) {
      console.error(`   ✗ Erro ao listar produtos: ${listError.message}`)
      if (listError.code) console.error(`     Code: ${listError.code}`)
      console.log()
    }

    // 5. Testar data feeds
    console.log('5. Testando listagem de data feeds...')
    try {
      const datafeeds = await content.datafeeds.list({
        auth: authClient,
        merchantId: MERCHANT_ID,
      })
      const feeds = datafeeds.data.resources || []
      console.log(`   ✓ Feeds encontrados: ${feeds.length}`)
      feeds.forEach((f: any, i: number) => {
        console.log(`   ${i + 1}. ${f.name} (ID: ${f.id})`)
      })
      if (feeds.length === 0) {
        console.log(
          '   ℹ Nenhum feed encontrado via Content API (normal para API Merchant feeds)'
        )
      }
      console.log()
    } catch (feedError: any) {
      console.error(`   ✗ Erro ao listar feeds: ${feedError.message}`)
      if (feedError.code) console.error(`     Code: ${feedError.code}`)
      console.log()
    }

    // 6. Testar productstatuses
    console.log('6. Testando status de produtos...')
    try {
      const statuses = await content.productstatuses.list({
        auth: authClient,
        merchantId: MERCHANT_ID,
        maxResults: 5,
      })
      const resources = statuses.data.resources || []
      console.log(`   ✓ Product statuses: ${resources.length}`)
      resources.forEach((s: any, i: number) => {
        console.log(
          `   ${i + 1}. ${s.title} - Destinos: ${JSON.stringify(s.destinationStatuses?.map((d: any) => `${d.destination}: ${d.status}`))}`
        )
      })
      console.log()
    } catch (statusError: any) {
      console.error(`   ✗ Erro ao listar status: ${statusError.message}`)
      console.log()
    }

    console.log('=== Teste finalizado ===')
  } catch (authError: any) {
    console.error(`   ✗ Erro de autenticação: ${authError.message}`)
    console.log('\n   Possíveis causas:')
    console.log('   - Chave privada inválida ou corrompida')
    console.log(
      '   - Content API for Shopping não habilitada no Google Cloud Console'
    )
    console.log('   - Service Account sem permissões no projeto Google Cloud')
    process.exit(1)
  }
}

main().catch(console.error)
