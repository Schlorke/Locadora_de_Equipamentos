import type { AccessError } from '@gb-locacoes/contracts/entitlements'

export class PaymentRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly policy?: AccessError | { error: string }
  ) {
    super(message)
  }
}
