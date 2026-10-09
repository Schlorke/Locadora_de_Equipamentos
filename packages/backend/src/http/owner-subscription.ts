import type { TenantPrincipal } from '../modules/identity/index'
import {
  createOwnerSubscriptionReader,
  OwnerSubscriptionReadError,
} from '../modules/subscriptions/index'

function ownerSubscriptionResponse(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store')
  const vary = new Set(
    (response.headers.get('Vary') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  )
  vary.add('Cookie')
  vary.add('Host')
  response.headers.set('Vary', [...vary].join(', '))
  return response
}
const ownerSubscriptionUnavailable = () =>
  ownerSubscriptionResponse(
    Response.json(
      { error: 'Não foi possível consultar a assinatura.' },
      { status: 503 }
    )
  )

export function createOwnerSubscriptionReadHandlers(
  ports: Parameters<typeof createOwnerSubscriptionReader>[0]
) {
  const reader = createOwnerSubscriptionReader(ports)
  const respond = async (read: () => Promise<unknown>) => {
    try {
      return ownerSubscriptionResponse(Response.json(await read()))
    } catch (error) {
      if (error instanceof OwnerSubscriptionReadError)
        return ownerSubscriptionResponse(
          Response.json(
            {
              error:
                error.code === 'OWNER_REQUIRED'
                  ? 'Esta operação é exclusiva do dono da locadora.'
                  : 'Assinatura não encontrada.',
              code: error.code,
            },
            { status: error.status }
          )
        )
      return ownerSubscriptionUnavailable()
    }
  }
  return {
    readOwnerSubscription: (principal: TenantPrincipal) =>
      respond(() => reader.readSummary(principal)),
    readOwnerInvoices: (principal: TenantPrincipal) =>
      respond(() => reader.readInvoices(principal)),
  }
}
