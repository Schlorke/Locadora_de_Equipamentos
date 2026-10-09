import type { LocalBusinessData } from '../../../entities/configuracao'
export interface ProductData {
  name: string
  description: string
  image: string[]
  /** Marca e fabricante: a própria locadora; ausentes, ficam de fora. */
  brand?: string
  sku?: string
  offers: {
    price: number
    priceCurrency: string
    availability: string
    url: string
  }
  category: string
  manufacturer?: string
  /** Vendedor da oferta: a própria locadora (nome do cartão e origem do site dela). */
  seller?: { name: string; url?: string }
  /** UF de entrega: a do cartão da própria locadora; ausente, a entrega fica só no país (achado 143). */
  shippingRegion?: string
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export interface StructuredDataProps {
  localBusiness?: LocalBusinessData | null
  product?: ProductData
  breadcrumbs?: BreadcrumbItem[]
}
