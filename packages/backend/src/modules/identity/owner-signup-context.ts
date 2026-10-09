import { AsyncLocalStorage } from 'node:async_hooks'
import {
  OwnerRegistrationSchema,
  type OwnerRegistrationInput,
} from '@gb-locacoes/contracts/credentials'

const ownerSignup = new AsyncLocalStorage<Readonly<OwnerRegistrationInput>>()
/** Only the server account adapter enters this scope, never a URL, header or body flag. */
export function withOwnerAccountRegistration<T>(
  data: OwnerRegistrationInput,
  task: () => Promise<T>
): Promise<T> {
  return ownerSignup.run(
    Object.freeze({ ...OwnerRegistrationSchema.parse(data) }),
    task
  )
}
export function isOwnerAccountSignUp(body: unknown): boolean {
  const current = ownerSignup.getStore()
  if (!current || !body || typeof body !== 'object') return false
  const candidate = body as Record<string, unknown>
  return (
    candidate.name === current.name &&
    candidate.email === current.email &&
    candidate.password === current.password
  )
}
