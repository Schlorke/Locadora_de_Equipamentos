/**
 * Script para executar sincronização com Google Merchant Center
 * Uso: npx tsx scripts/run-sync.ts
 */
import dotenv from 'dotenv'
import { resolve } from 'path'

// Carregar .env.local ANTES de importar os módulos
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// Import dinâmico para garantir que as env vars estão carregadas
async function main() {
  // Verificar URL sendo usada
  const websiteUrl =
    process.env.GOOGLE_MERCHANT_WEBSITE_URL || 'https://locacoesgb.com.br'
  console.log(`Website URL: ${websiteUrl}`)
  console.log(`Merchant ID: ${process.env.GOOGLE_MERCHANT_ID}`)
  console.log()

  const { googleMerchantSync } = await import('./ops/google-merchant')

  console.log('=== Iniciando Sincronização Google Merchant Center ===\n')

  const result = await googleMerchantSync.syncAllEquipments()

  console.log('\n=== Resultado da Sincronização ===')
  console.log(`Total: ${result.total}`)
  console.log(`Inseridos: ${result.inserted}`)
  console.log(`Atualizados: ${result.updated}`)
  console.log(`Removidos: ${result.deleted}`)
  console.log(`Erros: ${result.errors.length}`)

  if (result.errors.length > 0) {
    console.log('\nErros:')
    result.errors.forEach((e) => {
      console.log(`  - ${e.equipmentId}: ${e.error}`)
    })
  }

  console.log(`\nSucesso: ${result.success}`)
}

main().catch(console.error)
