/**
 * Google Merchant Center Integration
 *
 * Esta biblioteca integra o catálogo de equipamentos da GB Locações
 * com o Google Merchant Center usando a Content API for Shopping.
 *
 * Quarentena COD-04 (tools/hygiene-baseline.json): porte de lib/google-merchant na onda 135 (D9 = portar), para o
 * código sobreviver à exclusão da raiz legada. Continua desligado: createGoogleMerchantClient recusa com
 * GOOGLE_MERCHANT_LEGACY_DISABLED até o feed por locadora ser aprovado. Consumidores: scripts/run-sync.ts e
 * scripts/resync-products.ts.
 */

export * from './types'
export * from './client'
export * from './mapper'
export * from './sync-service'
