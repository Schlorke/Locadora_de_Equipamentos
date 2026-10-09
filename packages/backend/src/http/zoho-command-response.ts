import { SubscriptionCommandError } from '../modules/entitlements/command-admission'
import { ZohoCommandError } from '../modules/communications/zoho-command'
export function zohoCommandResponse(error: unknown): Response | null {
  if (
    !(error instanceof SubscriptionCommandError) &&
    !(error instanceof ZohoCommandError)
  )
    return null
  return Response.json(
    error instanceof SubscriptionCommandError
      ? error.body
      : { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
    }
  )
}
