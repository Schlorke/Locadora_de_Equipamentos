import { calculateFreight } from "@gb-locacoes/domain/orcamento";
import type { FreightCalculationRequest, FreightCalculationResult } from "@gb-locacoes/domain/orcamento";
export { calculateFreight } from "@gb-locacoes/domain/orcamento";
export type { FreightCalculationRequest, FreightCalculationResult, FreightOption } from "@gb-locacoes/domain/orcamento";

export async function calculateFreightWithAPI(
  request: FreightCalculationRequest,
  equipmentDimensions: Array<{
    width: number
    height: number
    length: number
    weight: number
  }>
): Promise<FreightCalculationResult> {
  try {
    const response = await fetch('/api/integrations/melhor-envio/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          postal_code: request.fromCEP.replace(/\D/g, ''),
        },
        to: {
          postal_code: request.toCEP.replace(/\D/g, ''),
        },
        products: equipmentDimensions.map((dim, index) => ({
          id: request.equipmentIds[index] || `eq-${index}`,
          width: dim.width,
          height: dim.height,
          length: dim.length,
          weight: dim.weight,
          quantity: request.quantities[index] || 1,
        })),
      }),
    })

    if (!response.ok) {
      throw new Error('Erro ao calcular frete')
    }

    const data = await response.json()
    return {
      shippingOptions: data.shippingOptions || [],
      chargeableWeight: data.chargeableWeight,
      note: data.note,
    }
  } catch (error) {
    console.error('Erro ao calcular frete com API:', error)
    // Fallback para cálculo estimado
    return calculateFreight(request)
  }
}
