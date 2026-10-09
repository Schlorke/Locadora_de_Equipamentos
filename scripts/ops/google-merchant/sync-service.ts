import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { createGoogleMerchantClient, type GoogleMerchantClient } from './client'
import { equipmentToGoogleProduct, createGoogleProductId } from './mapper'
import type { SyncResult } from './types'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Serviço de sincronização entre o banco de dados e o Google Merchant Center
 */
export class GoogleMerchantSyncService {
  /**
   * Sincroniza todos os equipamentos disponíveis com o Google Merchant
   */
  async syncAllEquipments(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      total: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    }

    try {
      const client = createGoogleMerchantClient()

      // Buscar todos os equipamentos ativos com suas categorias
      const equipments = await getDatabaseRuntime().prisma.equipment.findMany({
        where: {
          available: true, // Apenas equipamentos disponíveis
        },
        include: {
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      result.total = equipments.length

      console.log(
        `Iniciando sincronização de ${equipments.length} equipamentos...`
      )

      // Processar cada equipamento
      for (const equipment of equipments) {
        try {
          const googleProduct = equipmentToGoogleProduct(equipment)
          const productId = createGoogleProductId(equipment.id)

          // Verificar se produto já existe
          const existingProduct = await client.getProduct(productId)

          if (existingProduct) {
            // Atualizar produto existente
            await client.updateProduct(productId, googleProduct)
            result.updated++
            console.log(`✓ Equipamento ${equipment.name} atualizado`)
          } else {
            // Inserir novo produto
            await client.insertProduct(googleProduct)
            result.inserted++
            console.log(`✓ Equipamento ${equipment.name} inserido`)
          }
        } catch (error: unknown) {
          const msg = errorMessage(error)
          console.error(`✗ Erro ao sincronizar ${equipment.name}:`, msg)
          result.errors.push({
            equipmentId: equipment.id,
            error: msg,
          })
        }
      }

      // Remover produtos do Google que não existem mais no banco
      const deletedCount = await this.removeDeletedEquipments(
        client,
        equipments.map((e) => e.id)
      )
      result.deleted = deletedCount

      console.log(`Sincronização concluída:`, {
        inseridos: result.inserted,
        atualizados: result.updated,
        removidos: result.deleted,
        erros: result.errors.length,
      })

      result.success = result.errors.length === 0
      return result
    } catch (error: unknown) {
      console.error('Erro fatal na sincronização:', error)
      result.success = false
      result.errors.push({
        equipmentId: 'GLOBAL',
        error: errorMessage(error),
      })
      return result
    }
  }

  /**
   * Sincroniza um equipamento específico
   */
  async syncEquipment(equipmentId: string): Promise<void> {
    const client = createGoogleMerchantClient()

    const equipment = await getDatabaseRuntime().prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: { category: true },
    })

    if (!equipment) {
      throw new Error(`Equipamento ${equipmentId} não encontrado`)
    }

    const googleProduct = equipmentToGoogleProduct(equipment)
    const productId = createGoogleProductId(equipment.id)

    if (equipment.available) {
      // Inserir ou atualizar
      const existingProduct = await client.getProduct(productId)

      if (existingProduct) {
        await client.updateProduct(productId, googleProduct)
        console.log(
          `Equipamento ${equipment.name} atualizado no Google Merchant`
        )
      } else {
        await client.insertProduct(googleProduct)
        console.log(`Equipamento ${equipment.name} inserido no Google Merchant`)
      }
    } else {
      // Remover se não estiver disponível
      const deleted = await client.deleteProduct(productId)
      if (deleted) {
        console.log(`Equipamento ${equipment.name} removido do Google Merchant`)
      }
    }
  }

  /**
   * Remove um equipamento do Google Merchant
   */
  async removeEquipment(equipmentId: string): Promise<void> {
    const client = createGoogleMerchantClient()
    const productId = createGoogleProductId(equipmentId)

    const deleted = await client.deleteProduct(productId)
    if (deleted) {
      console.log(`Produto ${equipmentId} removido do Google Merchant`)
    } else {
      console.log(`Produto ${equipmentId} não existia no Google Merchant`)
    }
  }

  /**
   * Remove produtos do Google que não existem mais no banco de dados
   */
  private async removeDeletedEquipments(
    client: GoogleMerchantClient,
    activeEquipmentIds: string[]
  ): Promise<number> {
    try {
      // Listar todos os produtos no Google Merchant
      const googleProducts = await client.listProducts()

      let deletedCount = 0

      for (const googleProduct of googleProducts) {
        const offerId = googleProduct.offerId

        // Se o produto não existe mais no banco, remover do Google
        if (!activeEquipmentIds.includes(offerId)) {
          try {
            await client.deleteProduct(googleProduct.id)
            deletedCount++
            console.log(`✓ Produto órfão ${offerId} removido`)
          } catch (error: unknown) {
            console.error(
              `✗ Erro ao remover produto órfão ${offerId}:`,
              errorMessage(error)
            )
          }
        }
      }

      return deletedCount
    } catch (error: unknown) {
      console.error('Erro ao remover produtos órfãos:', errorMessage(error))
      return 0
    }
  }

  /**
   * Limpa todos os produtos do Google Merchant
   * ⚠️ USE COM CUIDADO - Remove todos os produtos
   */
  async clearAllProducts(): Promise<number> {
    const client = createGoogleMerchantClient()
    const products = await client.listProducts()

    let deletedCount = 0

    for (const product of products) {
      try {
        await client.deleteProduct(product.id)
        deletedCount++
        console.log(`✓ Produto ${product.offerId} removido`)
      } catch (error: unknown) {
        console.error(
          `✗ Erro ao remover ${product.offerId}:`,
          errorMessage(error)
        )
      }
    }

    return deletedCount
  }
}

/**
 * Instância singleton do serviço
 */
export const googleMerchantSync = new GoogleMerchantSyncService()
