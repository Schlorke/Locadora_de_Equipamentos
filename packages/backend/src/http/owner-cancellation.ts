import {
  EmptyActionInputSchema,
  ReactivateSubscriptionInputSchema,
  OwnerSubscriptionCommandKeySchema,
  OwnerSubscriptionActionResponseSchema,
} from '@gb-locacoes/contracts/subscription'
import { FreshSessionRequiredErrorSchema } from '@gb-locacoes/contracts/entitlements'
import {
  isFreshAuthentication,
  type TenantPrincipal,
} from '../modules/identity/index'
import {
  createOwnerSubscriptionCancellation,
  createOwnerSubscriptionActivation,
  createOwnerSubscriptionReactivation,
  OwnerSubscriptionCommandError,
} from '../modules/subscriptions/index'

const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
  })
/** Thin HTTP parsing; engines supply trusted authentication time, not headers/body. */
export function createOwnerSubscriptionActionHandler(
  ports: Parameters<typeof createOwnerSubscriptionCancellation>[0] & {
    environment?: 'sandbox' | 'production'
    getSession(): Promise<{
      user?: { id?: string }
      authenticatedAt?: number
    } | null>
  }
) {
  const command = createOwnerSubscriptionCancellation(ports)
  const activate = createOwnerSubscriptionActivation(ports)
  const reactivate = createOwnerSubscriptionReactivation(ports)
  return async (
    request: Request,
    principal: TenantPrincipal,
    action: 'activate' | 'cancel' | 'undo-cancel' | 'reactivate'
  ) => {
    try {
      const session = await ports.getSession()
      const now = (ports.now ?? (() => new Date()))()
      if (
        session?.user?.id !== principal.userId ||
        !isFreshAuthentication(session.authenticatedAt, now)
      )
        return reply(
          FreshSessionRequiredErrorSchema.parse({
            error: 'Entre novamente na sua conta para confirmar esta ação.',
            code: 'FRESH_SESSION_REQUIRED',
          }),
          401
        )
      const key = OwnerSubscriptionCommandKeySchema.safeParse(
        request.headers.get('Idempotency-Key')
      )
      if (!key.success)
        return reply(
          {
            error: 'Chave de idempotência inválida.',
            code: 'INVALID_IDEMPOTENCY_KEY',
          },
          400
        )
      const reader = request.body?.getReader()
      let text = '',
        bytes = 0
      if (reader) {
        const decoder = new TextDecoder()
        try {
          for (;;) {
            const chunk = await reader.read()
            if (chunk.done) {
              text += decoder.decode()
              break
            }
            bytes += chunk.value.byteLength
            if (bytes > 1024) {
              await reader.cancel()
              return reply({ error: 'Corpo excede o limite.' }, 413)
            }
            text += decoder.decode(chunk.value, { stream: true })
          }
        } finally {
          reader.releaseLock()
        }
      }
      let body: unknown = {}
      if (text.length) {
        if (
          request.headers.get('Content-Type')?.split(';')[0]?.trim() !==
          'application/json'
        )
          return reply({ error: 'Corpo JSON obrigatório.' }, 415)
        try {
          body = JSON.parse(text)
        } catch {
          return reply({ error: 'Corpo inválido.' }, 400)
        }
        if (
          action !== 'reactivate' &&
          !EmptyActionInputSchema.safeParse(body).success
        )
          return reply({ error: 'Corpo inválido.' }, 400)
      }
      const selected =
        action === 'reactivate'
          ? ReactivateSubscriptionInputSchema.safeParse(body)
          : undefined
      const input = { key: key.data, authenticatedAt: session.authenticatedAt! }
      let accepted
      if (action === 'reactivate') {
        if (!selected?.success) return reply({ error: 'Corpo inválido.' }, 400)
        accepted = await reactivate(principal, {
          ...input,
          planVersionId: selected.data.planVersionId,
        })
      } else if (action === 'activate')
        accepted = await activate(principal, input)
      else accepted = await command(principal, { ...input, action })
      return reply(OwnerSubscriptionActionResponseSchema.parse(accepted))
    } catch (error) {
      if (error instanceof OwnerSubscriptionCommandError)
        return reply(
          {
            error: 'Não foi possível confirmar esta ação da assinatura.',
            code: error.code,
          },
          error.status
        )
      return reply(
        { error: 'Não foi possível confirmar esta ação da assinatura.' },
        503
      )
    }
  }
}
