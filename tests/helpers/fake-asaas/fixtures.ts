import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Fixtures sanitizadas do Asaas. Cada arquivo é o MOLDE de uma resposta documentada: o dublê só
 * devolve campos que existem no molde. O lote S15 regrava estes arquivos a partir do sandbox
 * (valores sanitizados) e o dublê passa a seguir o formato regravado sem mudar código.
 */
export const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url))

export type FixtureName =
  | 'access-token'
  | 'account'
  | 'account-created.access-token'
  | 'account-created.api-key'
  | 'account-status'
  | 'commercial-info'
  | 'customer'
  | 'deleted'
  | 'errors'
  | 'identification-field'
  | 'list'
  | 'payment'
  | 'pix-qr-code'
  | 'subscription'
  | 'webhook'
  | 'webhook-event'

const cache = new Map<string, unknown>()

export function loadFixture<T = Record<string, unknown>>(name: FixtureName): T {
  if (!cache.has(name)) cache.set(name, JSON.parse(readFileSync(path.join(FIXTURES_DIR, name + '.json'), 'utf8')))
  return structuredClone(cache.get(name)) as T
}

export function listFixtureFiles(): string[] {
  return readdirSync(FIXTURES_DIR).filter((file) => file.endsWith('.json')).sort()
}
