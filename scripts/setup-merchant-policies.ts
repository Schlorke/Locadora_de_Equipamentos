// @ts-nocheck
/**
 * Script para configurar políticas de frete e devolução no Google Merchant Center
 *
 * Resolve o problema de "Sem índice de qualidade" configurando:
 * 1. Shipping Settings - Política de frete para o Brasil
 * 2. Return Policy - Política de devolução online
 *
 * Uso: npx tsx scripts/setup-merchant-policies.ts
 */

import { google } from 'googleapis'
import { config } from 'dotenv'

// Carregar .env.local (onde as credenciais ficam no Next.js)
config({ path: '.env.local' })
config({ path: '.env' })

const content = google.content('v2.1')

// ─── Configuração ───────────────────────────────────────────

const MERCHANT_ID = process.env.GOOGLE_MERCHANT_ID || ''
const SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL || ''
const SERVICE_ACCOUNT_KEY =
  process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY || ''
const WEBSITE_URL =
  process.env.GOOGLE_MERCHANT_WEBSITE_URL || 'https://locacoesgb.com.br'

if (!MERCHANT_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
  console.error('❌ Variáveis de ambiente do Google Merchant não configuradas.')
  console.error(
    'Necessárias: GOOGLE_MERCHANT_ID, GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL, GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY'
  )
  process.exit(1)
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: SERVICE_ACCOUNT_EMAIL,
    private_key: SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/content'],
})

// ─── 1. Configurar Shipping Settings ───────────────────────

async function setupShippingSettings() {
  console.log('\n📦 Configurando política de frete...')

  const authClient = await auth.getClient()

  // Primeiro, verificar configuração atual
  try {
    const current = await content.shippingsettings.get({
      auth: authClient,
      merchantId: MERCHANT_ID,
      accountId: MERCHANT_ID, // Para contas não-MCA, usar mesmo ID
    })
    console.log(
      '  Configuração atual:',
      JSON.stringify(current.data.services?.map((s) => s.name) || [], null, 2)
    )
  } catch {
    console.log('  Nenhuma configuração existente encontrada.')
  }

  // Configurar frete para o Brasil
  // Para locação de equipamentos, o frete geralmente é incluso ou negociado
  const shippingSettings = {
    accountId: MERCHANT_ID,
    services: [
      {
        name: 'Entrega Padrão',
        deliveryCountry: 'BR',
        currency: 'BRL',
        active: true,
        deliveryTime: {
          minHandlingTimeInDays: 1,
          maxHandlingTimeInDays: 3,
          minTransitTimeInDays: 1,
          maxTransitTimeInDays: 7,
        },
        rateGroups: [
          {
            name: 'Frete Grátis',
            singleValue: {
              flatRate: {
                value: '0',
                currency: 'BRL',
              },
            },
          },
        ],
        eligibility: 'All scenarios',
        shipmentType: 'delivery',
      },
      {
        name: 'Retirada no Local',
        deliveryCountry: 'BR',
        currency: 'BRL',
        active: true,
        deliveryTime: {
          minHandlingTimeInDays: 0,
          maxHandlingTimeInDays: 1,
          minTransitTimeInDays: 0,
          maxTransitTimeInDays: 0,
        },
        rateGroups: [
          {
            name: 'Grátis',
            singleValue: {
              flatRate: {
                value: '0',
                currency: 'BRL',
              },
            },
          },
        ],
        eligibility: 'All scenarios',
        shipmentType: 'delivery',
      },
    ],
  }

  try {
    const response = await content.shippingsettings.update({
      auth: authClient,
      merchantId: MERCHANT_ID,
      accountId: MERCHANT_ID,
      requestBody: shippingSettings,
    })

    console.log('  ✅ Política de frete configurada com sucesso!')
    console.log(
      '  Serviços:',
      response.data.services?.map((s) => s.name).join(', ')
    )
  } catch (error: unknown) {
    const err = error as { message?: string; errors?: unknown[] }
    console.error('  ❌ Erro ao configurar frete:', err.message)
    if (err.errors) {
      console.error('  Detalhes:', JSON.stringify(err.errors, null, 2))
    }
    throw error
  }
}

// ─── 2. Configurar Return Policy ────────────────────────────

async function setupReturnPolicy() {
  console.log('\n🔄 Configurando política de devolução...')

  const authClient = await auth.getClient()
  const accessToken = (await authClient.getAccessToken()).token

  const baseUrl = `https://shoppingcontent.googleapis.com/content/v2.1/${MERCHANT_ID}`
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // Listar políticas existentes
  try {
    const listRes = await fetch(`${baseUrl}/returnpolicyonline`, { headers })
    if (listRes.ok) {
      const data = await listRes.json()
      const policies = data.returnPolicies || []
      console.log(`  Políticas existentes (online): ${policies.length}`)
      if (policies.length > 0) {
        for (const p of policies) {
          console.log(
            `    - ${p.label} (${p.returnPolicyId}) - ${p.countries?.join(', ')}`
          )
        }
        console.log('  ⚠️  Políticas já existem. Pulando criação.')
        return
      }
    }
  } catch {
    // ignorar - vamos tentar criar
  }

  // Tentar criar via returnpolicyonline (API moderna)
  // A REST API usa enums UPPER_SNAKE_CASE
  const returnPolicyOnline = {
    name: 'Política de Devolução Padrão',
    label: 'Política de Devolução - GB Locações',
    countries: ['BR'],
    returnPolicyUri: `${WEBSITE_URL}/politica-devolucao`,
    policy: {
      type: 'NUMBER_OF_DAYS_AFTER_DELIVERY',
      days: '30',
    },
    restockingFee: {
      fixedFee: {
        value: '0',
        currency: 'BRL',
      },
    },
    returnMethods: ['IN_STORE'],
    itemConditions: ['NEW'],
  }

  console.log('  Tentando returnpolicyonline (API moderna)...')
  const createRes = await fetch(`${baseUrl}/returnpolicyonline`, {
    method: 'POST',
    headers,
    body: JSON.stringify(returnPolicyOnline),
  })

  if (createRes.ok) {
    const data = await createRes.json()
    console.log('  ✅ Política de devolução (online) criada com sucesso!')
    console.log('  ID:', data.returnPolicyId)
    console.log('  Label:', data.label)
    return
  }

  const onlineError = await createRes.text()
  console.log(
    `  returnpolicyonline falhou (${createRes.status}): ${onlineError}`
  )

  // Fallback: tentar returnpolicy (API legacy)
  console.log('  Tentando returnpolicy (API legacy)...')
  const legacyPolicy = {
    label: 'Política de Devolução - GB Locações',
    country: 'BR',
    name: 'Política de Devolução Padrão',
    policy: {
      type: 'numberOfDaysAfterDelivery',
      numberOfDays: '30',
    },
    nonFreeReturnReasons: [],
  }

  const legacyRes = await fetch(`${baseUrl}/returnpolicy`, {
    method: 'POST',
    headers,
    body: JSON.stringify(legacyPolicy),
  })

  if (legacyRes.ok) {
    const data = await legacyRes.json()
    console.log('  ✅ Política de devolução (legacy) criada com sucesso!')
    console.log('  ID:', data.returnPolicyId)
    console.log('  Label:', data.label)
    return
  }

  const legacyError = await legacyRes.text()
  console.error(
    `  ❌ returnpolicy também falhou (${legacyRes.status}): ${legacyError}`
  )
  throw new Error(
    `Não foi possível criar política de devolução. Online: ${onlineError}. Legacy: ${legacyError}`
  )
}

// ─── 3. Verificar Status Final ──────────────────────────────

async function verifyConfiguration() {
  console.log('\n🔍 Verificando configuração final...')

  const authClient = await auth.getClient()

  // Verificar shipping
  try {
    const shipping = await content.shippingsettings.get({
      auth: authClient,
      merchantId: MERCHANT_ID,
      accountId: MERCHANT_ID,
    })
    const services = shipping.data.services || []
    console.log(`  📦 Frete: ${services.length} serviço(s) configurado(s)`)
    for (const svc of services) {
      console.log(
        `    - ${svc.name} (${svc.deliveryCountry}, ativo: ${svc.active})`
      )
    }
  } catch {
    console.log('  ⚠️  Não foi possível verificar configuração de frete')
  }

  // Verificar return policy via REST
  const accessToken = (await authClient.getAccessToken()).token
  const baseUrl = `https://shoppingcontent.googleapis.com/content/v2.1/${MERCHANT_ID}`
  const headers = { Authorization: `Bearer ${accessToken}` }

  try {
    const res = await fetch(`${baseUrl}/returnpolicyonline`, { headers })
    if (res.ok) {
      const data = await res.json()
      const policies = data.returnPolicies || []
      console.log(
        `  🔄 Devolução: ${policies.length} política(s) configurada(s)`
      )
      for (const pol of policies) {
        console.log(`    - ${pol.label} (${pol.countries?.join(', ')})`)
      }
    } else {
      // Tentar legacy
      const legacyRes = await fetch(`${baseUrl}/returnpolicy`, { headers })
      if (legacyRes.ok) {
        const data = await legacyRes.json()
        const policies = data.resources || []
        console.log(`  🔄 Devolução (legacy): ${policies.length} política(s)`)
      }
    }
  } catch {
    console.log('  ⚠️  Não foi possível verificar política de devolução')
  }

  console.log(`\n  🌐 Website: ${WEBSITE_URL}`)
  console.log(`  🏪 Merchant ID: ${MERCHANT_ID}`)
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Google Merchant Center - Configuração de Políticas')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Merchant ID: ${MERCHANT_ID}`)
  console.log(`  Website: ${WEBSITE_URL}`)

  try {
    await setupShippingSettings()
    await setupReturnPolicy()
    await verifyConfiguration()

    console.log('\n✅ Configuração concluída com sucesso!')
    console.log('   O índice de qualidade do Merchant Center pode levar')
    console.log('   algumas horas/dias para ser recalculado pelo Google.')
  } catch (error) {
    console.error('\n❌ Erro durante a configuração:', error)
    process.exit(1)
  }
}

main()
