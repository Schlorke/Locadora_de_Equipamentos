/**
 * Falha de regra de cliente (carrinho, perfil, documentos). O adaptador HTTP
 * responde `{ error: message }` com `status`.
 */
import type { AccessError } from '@gb-locacoes/contracts/entitlements'
export class CustomerError extends Error {
  readonly status: 400 | 402 | 403 | 404 | 503
  constructor(
    message: string,
    status: 400 | 402 | 403 | 404 | 503,
    readonly policy?: AccessError | { error: string }
  ) {
    super(message)
    this.name = 'CustomerError'
    this.status = status
  }
}
