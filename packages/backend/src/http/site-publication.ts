import { EmptyActionInputSchema } from '@gb-locacoes/contracts/subscription'
import { SitePublicationResponseSchema } from '@gb-locacoes/contracts/onboarding'
import type { TenantPrincipal } from '../modules/identity/index'
import {
  createSitePublication,
  SitePublicationError,
} from '../modules/onboarding/index'
import {
  onboardingAppOrigin,
  onboardingReply,
  onboardingFailure,
} from './onboarding'

export function createSitePublicationHandler(
  ports: Parameters<typeof createSitePublication>[0] & {
    environment(): Readonly<Record<string, string | undefined>>
  }
) {
  const publish = createSitePublication(ports)
  return async (request: Request, principal: TenantPrincipal) => {
    try {
      if (request.method !== 'POST')
        return onboardingReply({ error: 'Método não permitido.' }, 405, {
          Allow: 'POST',
        })
      onboardingAppOrigin(request, ports.environment())
      if (new URL(request.url).search)
        return onboardingReply({ error: 'Consulta inválida.' }, 400)
      const reader = request.body?.getReader()
      let text = '',
        bytes = 0
      if (reader) {
        const decoder = new TextDecoder('utf-8', { fatal: true })
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
              return onboardingReply({ error: 'Corpo excede o limite.' }, 413)
            }
            text += decoder.decode(chunk.value, { stream: true })
          }
        } catch {
          return onboardingReply({ error: 'Corpo inválido.' }, 400)
        } finally {
          reader.releaseLock()
        }
      }
      if (text.length) {
        if (
          request.headers
            .get('Content-Type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase() !== 'application/json'
        )
          return onboardingReply({ error: 'Corpo JSON obrigatório.' }, 415)
        let body: unknown
        try {
          body = JSON.parse(text)
        } catch {
          return onboardingReply({ error: 'Corpo inválido.' }, 400)
        }
        if (!EmptyActionInputSchema.safeParse(body).success)
          return onboardingReply({ error: 'Corpo inválido.' }, 400)
      }
      return onboardingReply(
        SitePublicationResponseSchema.parse(await publish(principal))
      )
    } catch (error) {
      if (error instanceof SitePublicationError)
        return onboardingReply(
          { error: 'Não foi possível publicar o site.', code: error.code },
          error.status
        )
      return onboardingFailure(error)
    }
  }
}
