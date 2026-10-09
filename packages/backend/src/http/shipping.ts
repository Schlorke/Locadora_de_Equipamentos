import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { ShippingCalculationSchema } from '@gb-locacoes/contracts/operations'
import {
  ShippingError,
  type ShippingService,
} from '../modules/operations/shipping'
export function createShippingCalculationHandler(service: ShippingService) {
  return async function calculateShipping(
    principal: TenantContext,
    request: Request
  ) {
    const parsed = ShippingCalculationSchema.safeParse(await request.json())
    if (!parsed.success)
      return Response.json(
        { error: 'Dados de frete inválidos' },
        { status: 400 }
      )
    try {
      return Response.json(await service.calculate(principal, parsed.data))
    } catch (error) {
      if (error instanceof ShippingError)
        return Response.json({ error: error.message }, { status: error.status })
      throw error
    }
  }
}
