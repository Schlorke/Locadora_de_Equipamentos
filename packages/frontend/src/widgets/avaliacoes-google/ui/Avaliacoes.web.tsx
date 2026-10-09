'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

interface GoogleCustomerReviewsProps {
  /**
   * ID do Merchant Center da própria locadora (`siteContent.googleMerchantId`, onda 134). Sem ele nada é carregado
   * (achado 143: nunca a conta de outra locadora).
   */
  merchantId?: string | null
  // ID do pedido/orçamento
  orderId: string
  // Email do cliente
  customerEmail: string
  // País de entrega (código ISO)
  deliveryCountry?: string
  // Data estimada de entrega (formato YYYY-MM-DD)
  estimatedDeliveryDate?: string
  // Lista de GTINs dos produtos (opcional)
  products?: Array<{ gtin: string }>
}

/**
 * Componente para integração com Google Avaliações do Consumidor
 * Exibe um opt-in para o cliente avaliar a empresa após a locação
 *
 * Deve ser renderizado na página de confirmação de pedido/orçamento
 */
export function GoogleCustomerReviews({
  merchantId = null,
  orderId,
  customerEmail,
  deliveryCountry = 'BR',
  estimatedDeliveryDate,
  products,
}: GoogleCustomerReviewsProps) {
  const [isReady, setIsReady] = useState(false)

  // Calcular data estimada de entrega se não fornecida (7 dias a partir de hoje)
  const deliveryDate =
    estimatedDeliveryDate ||
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    // Definir função de callback para quando a API do Google carregar
    if (merchantId && typeof window !== 'undefined') {
      ;(window as Window & { renderOptIn?: () => void }).renderOptIn =
        function () {
          const gapi = (
            window as Window & {
              gapi?: {
                load: (_module: string, _callback: () => void) => void
                surveyoptin?: {
                  render: (_config: Record<string, unknown>) => void
                }
              }
            }
          ).gapi

          if (gapi) {
            gapi.load('surveyoptin', function () {
              if (gapi.surveyoptin) {
                const config: Record<string, unknown> = {
                  // Campos obrigatórios (o Google espera o ID numérico, como na produção)
                  merchant_id: Number(merchantId),
                  order_id: orderId,
                  email: customerEmail,
                  delivery_country: deliveryCountry,
                  estimated_delivery_date: deliveryDate,
                }

                // Adicionar produtos se fornecidos
                if (products && products.length > 0) {
                  config.products = products
                }

                gapi.surveyoptin.render(config)
                setIsReady(true)
              }
            })
          }
        }
    }
  }, [
    merchantId,
    orderId,
    customerEmail,
    deliveryCountry,
    deliveryDate,
    products,
  ])

  if (!merchantId) return null

  return (
    <>
      {/* Script da API do Google Platform; ao carregar, ele mesmo chama renderOptIn (?onload=renderOptIn) */}
      <Script
        src="https://apis.google.com/js/platform.js?onload=renderOptIn"
        strategy="lazyOnload"
        onError={() => {
          console.error('[Google Customer Reviews] Erro ao carregar script')
        }}
      />

      {/* Container para debug (opcional) */}
      {process.env.NODE_ENV === 'development' && isReady && (
        <div className="hidden">
          Google Customer Reviews carregado para pedido: {orderId}
        </div>
      )}
    </>
  )
}

type BadgePosition = 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'INLINE'

type MerchantWidget = {
  start: (_config: Record<string, unknown>) => void
}

interface GoogleMerchantBadgeProps {
  /** ID do Merchant Center da própria locadora (`siteContent.googleMerchantId`); sem ele, nenhum selo (achado 143). */
  merchantId?: string | null
  /** Posição do selo: INLINE renderiza dentro do container, BOTTOM_* flutua */
  position?: BadgePosition
  /** Região/país */
  region?: string
}

/**
 * Selo do Google Avaliações do Consumidor
 * Exibe o selo com a classificação do vendedor
 *
 * - position="INLINE": renderiza dentro de um container no fluxo da página
 * - position="BOTTOM_RIGHT" / "BOTTOM_LEFT": selo flutuante no canto da tela
 */
export function GoogleMerchantBadge({
  merchantId = null,
  position = 'INLINE',
  region = 'BR',
}: GoogleMerchantBadgeProps) {
  const initWidget = () => {
    const merchantwidget = (
      window as Window & { merchantwidget?: MerchantWidget }
    ).merchantwidget

    if (merchantwidget) {
      merchantwidget.start({
        merchant_id: Number(merchantId),
        position: position,
        region: region,
      })
    }
  }

  if (!merchantId) return null

  return (
    <>
      {/* Container para o selo INLINE — o Google injeta o badge aqui */}
      {position === 'INLINE' && <div id="google-merchant-badge" />}
      <Script
        id="merchantWidgetScript"
        src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
        strategy="lazyOnload"
        onLoad={initWidget}
        onError={() => {
          console.error('[Google Merchant Badge] Erro ao carregar script')
        }}
      />
    </>
  )
}
