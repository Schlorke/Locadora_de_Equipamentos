/**
 * Falha de regra de locação/cotação. O adaptador HTTP responde com `status` e
 * `message` (e `code`/`missingDocuments` onde o contrato da rota os expõe).
 */
export class RentalMutationError extends Error {
  readonly status: number
  readonly code: string
  readonly missingDocuments?: readonly string[]
  readonly policy?: AccessError | { error: string }
  constructor(
    message: string,
    status = 400,
    code = 'invalid_rental',
    missingDocuments?: readonly string[],
    policy?: AccessError | { error: string }
  ) {
    super(message)
    this.name = 'RentalMutationError'
    this.status = status
    this.code = code
    this.missingDocuments = missingDocuments
    this.policy = policy
  }
}
import type { AccessError } from '@gb-locacoes/contracts/entitlements'
