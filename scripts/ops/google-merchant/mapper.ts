import type { Equipment, Category } from '@prisma/client'
import { Decimal } from 'decimal.js'
import type { GoogleProduct } from './types'

type EquipmentWithCategory = Equipment & {
  category: Category
}

/**
 * Converte um Equipment do banco de dados para o formato Google Product
 */
export function equipmentToGoogleProduct(
  equipment: EquipmentWithCategory
): GoogleProduct {
  // URL de produção para o Merchant Center (nunca usar localhost)
  const websiteUrl =
    process.env.GOOGLE_MERCHANT_WEBSITE_URL || 'https://locacoesgb.com.br'
  const productUrl = `${websiteUrl}/equipamentos/${equipment.id}`

  // Formatar preço (Google espera string com 2 casas decimais)
  const priceValue = new Decimal(equipment.pricePerDay).toFixed(2)

  // Primeira imagem como principal, resto como adicionais
  const allImages = equipment.images || []
  const [mainImage, ...rawAdditionalImages] = allImages
  // Filtrar URLs inválidas (devem começar com http:// ou https://)
  const additionalImages = rawAdditionalImages.filter(
    (url) => url && (url.startsWith('http://') || url.startsWith('https://'))
  )

  // Determinar disponibilidade
  const availability = equipment.available ? 'in stock' : 'out of stock'

  // Criar descrição completa com especificações
  let description = equipment.description || equipment.name

  if (
    equipment.specifications &&
    typeof equipment.specifications === 'object'
  ) {
    const specs = equipment.specifications as Record<string, unknown>
    const specsText = Object.entries(specs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ')

    if (specsText) {
      description += `\n\nEspecificações: ${specsText}`
    }
  }

  // Criar produto no formato Google
  const product: GoogleProduct = {
    offerId: equipment.id,
    title: truncate(equipment.name, 150), // Google limita a 150 caracteres
    description: truncate(description, 5000), // Google limita a 5000 caracteres
    link: productUrl,
    imageLink:
      mainImage && mainImage.startsWith('http')
        ? mainImage
        : `${websiteUrl}/placeholder-equipment.jpg`,
    additionalImageLinks:
      additionalImages.length > 0 ? additionalImages.slice(0, 10) : undefined,
    contentLanguage: 'pt', // Português
    targetCountry: 'BR', // Brasil
    feedLabel: 'BR', // Rótulo do feed para associação correta no Merchant Center
    channel: 'online',
    availability,
    condition: 'used', // Equipamentos de locação são usados
    price: {
      value: priceValue,
      currency: 'BRL',
    },
    brand: 'GB Locações',
    identifierExists: false, // Equipamentos de locação não têm GTIN/MPN
    shipping: [
      {
        country: 'BR',
        service: 'Entrega Padrão',
        price: {
          value: '0',
          currency: 'BRL',
        },
      },
    ],
    productTypes: [equipment.category.name],
    customLabel0: equipment.category.slug, // Categoria
    customLabel1: equipment.popularPeriod || 'daily', // Período popular
    customLabel2: equipment.available ? 'disponivel' : 'indisponivel', // Status
    ...(equipment.maxStock && {
      customLabel3: `estoque_${equipment.maxStock}`,
    }),
  }

  // Adicionar categoria do Google (se mapeada)
  const googleCategory = mapCategoryToGoogleTaxonomy(equipment.category.name)
  if (googleCategory) {
    product.googleProductCategory = googleCategory
  }

  return product
}

/**
 * Mapeia categorias da GB Locações para taxonomia do Google
 * @see https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt
 */
function mapCategoryToGoogleTaxonomy(categoryName: string): string | undefined {
  const categoryMap: Record<string, string> = {
    // Equipamentos de Construção
    Escavadeiras: '632',
    Retroescavadeiras: '632',
    'Pá Carregadeira': '632',
    Compactadores: '632',
    'Rolos Compactadores': '632',

    // Elevação
    'Plataformas Elevatórias': '2878',
    Guindastes: '2878',
    Empilhadeiras: '2878',

    // Ferramentas Elétricas
    Betoneiras: '1167',
    Compressores: '1167',
    Geradores: '1305',

    // Andaimes
    Andaimes: '503006',
  }

  return categoryMap[categoryName]
}

/**
 * Trunca string no tamanho máximo
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Converte múltiplos equipamentos para produtos Google
 */
export function equipmentsToGoogleProducts(
  equipments: EquipmentWithCategory[]
): GoogleProduct[] {
  return equipments.map(equipmentToGoogleProduct)
}

/**
 * Cria ID de produto no formato esperado pelo Google
 * Formato: online:pt:BR:{offerId}
 */
export function createGoogleProductId(offerId: string): string {
  return `online:pt:BR:${offerId}`
}
