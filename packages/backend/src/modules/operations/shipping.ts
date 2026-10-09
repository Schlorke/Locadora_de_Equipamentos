import { integrationCredentialReference } from '../../runtime/index'
import { z } from 'zod'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { ShippingCalculationInput } from '@gb-locacoes/contracts/operations'
import type { createIntegrationCredentialResolver } from '../../runtime/integration-credentials'
import type { OperationsTransaction } from './types'
export class ShippingError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}
const providerNumber = z
  .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite().nonnegative())
const optionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  company: z.object({ name: z.string() }),
  price: providerNumber,
  delivery_time: providerNumber.pipe(z.number().int()),
  custom_price: providerNumber.optional(),
  custom_delivery_time: providerNumber.pipe(z.number().int()).optional(),
})

export function createShippingService({
  withTenantTransaction,
  resolveIntegrationCredential,
}: {
  withTenantTransaction: OperationsTransaction
  resolveIntegrationCredential: ReturnType<
    typeof createIntegrationCredentialResolver
  >
}) {
  return {
    async calculate(context: TenantContext, data: ShippingCalculationInput) {
      const config = await withTenantTransaction(context, async (tx) => {
        const integrations = await tx.tenantIntegration.findMany({
          where: {
            tenantId: context.tenantId,
            provider: 'MELHOR_ENVIO',
            status: 'ACTIVE',
            organization: { status: 'ACTIVE' },
          },
          take: 2,
        })
        const organization = await tx.organization.findUnique({
          where: { id: context.tenantId },
          select: { postalCode: true },
        })
        const ids = [...new Set(data.products.map((product) => product.id))]
        const equipmentCount = await tx.equipment.count({
          where: { tenantId: context.tenantId, id: { in: ids } },
        })
        return {
          integration: integrations.length === 1 ? integrations[0] : null,
          postalCode: organization?.postalCode?.replace(/\D/g, ''),
          validProducts: equipmentCount === ids.length,
        }
      })
      if (!config.validProducts)
        throw new ShippingError('Equipamento não encontrado', 404)
      if (!config.integration || !config.postalCode)
        throw new ShippingError('Frete da locadora não configurado', 503)
      if (config.postalCode !== data.from.postal_code)
        throw new ShippingError('CEP de origem diverge da locadora', 400)
      const credential = await resolveIntegrationCredential(
        integrationCredentialReference(config.integration)
      )
      if (
        !credential?.apiKey ||
        !['sandbox', 'production'].includes(credential.environment || '') ||
        !credential.userAgent ||
        !/^[^\r\n]{3,160}\([^()\r\n]+@[^()\r\n]+\)$/.test(credential.userAgent)
      )
        throw new ShippingError(
          'Credenciais de frete da locadora indisponíveis',
          503
        )
      const base =
        credential.environment === 'production'
          ? 'https://melhorenvio.com.br'
          : 'https://sandbox.melhorenvio.com.br'
      const response = await fetch(base + '/api/v2/me/shipment/calculate', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Bearer ${credential.apiKey}`,
          'User-Agent': credential.userAgent,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok)
        throw new ShippingError('Cotação indisponível no provedor', 502)
      const payload: unknown = await response.json()
      if (!Array.isArray(payload))
        throw new ShippingError('Resposta de frete inválida', 502)
      const shippingOptions = payload.flatMap((raw) => {
        const parsedOption = optionSchema.safeParse(raw)
        if (!parsedOption.success) return []
        const option = parsedOption.data
        const days = option.custom_delivery_time ?? option.delivery_time
        return [
          {
            id: option.id,
            name: option.name,
            company: option.company.name,
            price: option.custom_price ?? option.price,
            deliveryTime: `${days} dias úteis`,
            estimatedDays: days,
          },
        ]
      })
      const weight = data.products.reduce(
        (sum, item) => sum + item.weight * item.quantity,
        0
      )
      const volume = data.products.reduce(
        (sum, item) =>
          sum + (item.width * item.height * item.length * item.quantity) / 1000,
        0
      )
      return { shippingOptions, chargeableWeight: Math.max(weight, volume) }
    },
  }
}
export type ShippingService = ReturnType<typeof createShippingService>
