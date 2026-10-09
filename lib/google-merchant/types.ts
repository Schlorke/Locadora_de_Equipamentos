/**
 * Tipos para integração com Google Content API for Shopping
 * @see https://developers.google.com/shopping-content/reference/rest/v2.1/products
 */

export interface GoogleMerchantConfig {
  merchantId: string
  serviceAccountEmail: string
  serviceAccountKey: string
  websiteUrl: string
}

/**
 * Produto no formato do Google Merchant Center
 */
export interface GoogleProduct {
  offerId: string
  title: string
  description: string
  link: string
  imageLink: string
  additionalImageLinks?: string[]
  contentLanguage: string
  targetCountry: string
  feedLabel?: string
  channel: 'online' | 'local'
  availability: 'in stock' | 'out of stock' | 'preorder' | 'backorder'
  condition: 'new' | 'refurbished' | 'used'
  price: {
    value: string
    currency: string
  }
  brand?: string
  gtin?: string
  mpn?: string
  /** false quando o item não tem GTIN/MPN (ex: equipamentos de locação) */
  identifierExists?: boolean
  googleProductCategory?: string
  productTypes?: string[]
  shipping?: GoogleShipping[]
  /** Custom labels - campos top-level na API do Google (não nested) */
  customLabel0?: string
  customLabel1?: string
  customLabel2?: string
  customLabel3?: string
  customLabel4?: string
}

export interface GoogleShipping {
  country: string
  region?: string
  service?: string
  price: {
    value: string
    currency: string
  }
}

/**
 * Resposta da API do Google
 */
export interface GoogleProductResponse {
  kind: 'content#product'
  id: string
  offerId: string
  title: string
  description: string
  link: string
  imageLink: string
  contentLanguage: string
  targetCountry: string
  channel: string
  availability: string
  condition: string
  price: {
    value: string
    currency: string
  }
  /** Categorias do produto (retornado pela API) */
  productTypes?: string[]
}

export interface GoogleBatchResponse {
  kind: 'content#productsCustomBatchResponse'
  entries: GoogleBatchEntry[]
}

export interface GoogleBatchEntry {
  batchId: number
  product?: GoogleProductResponse
  errors?: {
    code: number
    message: string
    errors: Array<{
      domain: string
      reason: string
      message: string
    }>
  }
}

/**
 * Resultado da sincronização
 */
export interface SyncResult {
  success: boolean
  total: number
  inserted: number
  updated: number
  deleted: number
  errors: Array<{
    equipmentId: string
    error: string
  }>
}
