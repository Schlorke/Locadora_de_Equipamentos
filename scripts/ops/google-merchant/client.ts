import { google } from 'googleapis'
import type {
  GoogleMerchantConfig,
  GoogleProduct,
  GoogleProductResponse,
  GoogleBatchResponse,
} from './types'

const content = google.content('v2')

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Cliente para integração com Google Merchant Center
 *
 * Utiliza a Content API for Shopping v2.1, que é a API atual recomendada
 * para gerenciamento de produtos no Google Merchant Center.
 *
 * Requer:
 * - Merchant API habilitada no Google Cloud Console
 * - Service Account com permissões de administrador no Merchant Center
 * - Content API for Shopping habilitada (se solicitado pela API)
 *
 * @see https://developers.google.com/shopping-content/reference/rest
 */
export class GoogleMerchantClient {
  private merchantId: string
  /** Instância GoogleAuth; tipagem any por incompatibilidade googleapis getClient() vs Params */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- googleapis: o tipo de GoogleAuth.getClient() não casa com os Params das chamadas (ver JSDoc acima).
  private auth: any

  constructor(config: GoogleMerchantConfig) {
    this.merchantId = config.merchantId

    // Configurar autenticação com Service Account
    // Usa o escopo 'content' que funciona com ambas APIs (Content API e Merchant API)
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.serviceAccountEmail,
        private_key: config.serviceAccountKey.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/content', // Content API for Shopping
      ],
    })
  }

  /**
   * Insere um novo produto no Merchant Center
   */
  async insertProduct(product: GoogleProduct): Promise<GoogleProductResponse> {
    try {
      const authClient = await this.auth.getClient()

      const response = await content.products.insert({
        auth: authClient,
        merchantId: this.merchantId,
        requestBody: product,
      })

      return response.data as GoogleProductResponse
    } catch (error: unknown) {
      console.error(
        'Erro ao inserir produto no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha ao inserir produto: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  /**
   * Atualiza um produto existente
   * A API do Google não aceita campos imutáveis no body do UPDATE
   */
  async updateProduct(
    _productId: string,
    product: GoogleProduct
  ): Promise<GoogleProductResponse> {
    try {
      const authClient = await this.auth.getClient()

      // Content API v2 não expõe products.update. insert faz upsert pelo offerId.
      const response = await content.products.insert({
        auth: authClient,
        merchantId: this.merchantId,
        requestBody: product,
      })

      return response.data as GoogleProductResponse
    } catch (error: unknown) {
      console.error(
        'Erro ao atualizar produto no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha ao atualizar produto: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  /**
   * Remove um produto do Merchant Center
   * Retorna true se deletou, false se não existia (404)
   */
  async deleteProduct(productId: string): Promise<boolean> {
    try {
      const authClient = await this.auth.getClient()

      await content.products.delete({
        auth: authClient,
        merchantId: this.merchantId,
        productId,
      })
      return true
    } catch (error: unknown) {
      // 404 = produto não existe, operação logicamente bem-sucedida
      const err = error as { code?: number }
      if (err.code === 404) {
        return false
      }
      console.error(
        'Erro ao deletar produto no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha ao deletar produto: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  /**
   * Busca um produto pelo ID
   */
  async getProduct(productId: string): Promise<GoogleProductResponse | null> {
    try {
      const authClient = await this.auth.getClient()

      const response = await content.products.get({
        auth: authClient,
        merchantId: this.merchantId,
        productId,
      })

      return response.data as GoogleProductResponse
    } catch (error: unknown) {
      const err = error as { code?: number }
      if (err.code === 404) {
        return null
      }
      console.error(
        'Erro ao buscar produto no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha ao buscar produto: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  /**
   * Lista todos os produtos do Merchant Center
   */
  async listProducts(): Promise<GoogleProductResponse[]> {
    try {
      const authClient = await this.auth.getClient()

      const response = await content.products.list({
        auth: authClient,
        merchantId: this.merchantId,
        maxResults: 250, // Máximo permitido pela API
      })

      return (response.data.resources || []) as GoogleProductResponse[]
    } catch (error: unknown) {
      console.error(
        'Erro ao listar produtos no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha ao listar produtos: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  /**
   * Insere ou atualiza múltiplos produtos em lote (batch)
   * Mais eficiente para sincronização de muitos produtos
   */
  async batchUpsertProducts(
    products: GoogleProduct[]
  ): Promise<GoogleBatchResponse> {
    try {
      const authClient = await this.auth.getClient()

      const entries = products.map((product, index) => ({
        batchId: index,
        merchantId: this.merchantId,
        method: 'insert',
        product,
      }))

      const response = await content.products.custombatch({
        auth: authClient,
        requestBody: {
          entries,
        },
      })

      return response.data as GoogleBatchResponse
    } catch (error: unknown) {
      console.error(
        'Erro ao fazer batch insert no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha no batch insert: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }

  /**
   * Remove múltiplos produtos em lote
   */
  async batchDeleteProducts(
    productIds: string[]
  ): Promise<GoogleBatchResponse> {
    try {
      const authClient = await this.auth.getClient()

      const entries = productIds.map((productId, index) => ({
        batchId: index,
        merchantId: this.merchantId,
        method: 'delete',
        productId,
      }))

      const response = await content.products.custombatch({
        auth: authClient,
        requestBody: {
          entries,
        },
      })

      return response.data as GoogleBatchResponse
    } catch (error: unknown) {
      console.error(
        'Erro ao fazer batch delete no Google Merchant:',
        errorMessage(error)
      )
      throw new Error(`Falha no batch delete: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }
}

/**
 * Factory para criar instância do cliente
 */
export function createGoogleMerchantClient(): GoogleMerchantClient {
  throw new Error(
    'GOOGLE_MERCHANT_LEGACY_DISABLED: integração global Content API encerrada; oferta e adapter Merchant por locadora ainda não aprovados'
  )
}
