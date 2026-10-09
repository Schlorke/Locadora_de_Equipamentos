import { describe, expect, it } from 'vitest'
import { SecretValue } from '../modules/secrets/secret-value'
import { createApplicationLogger } from './logger'

describe('application structured logging', () => {
  it('redacts sensitive fields at every depth and never invokes plaintext accessors', () => {
    const output: string[] = []
    const logger = createApplicationLogger(
      {},
      {
        write: (line) => {
          output.push(line)
        },
      }
    )
    const credential = {
      get apiKey(): string {
        throw Error('must not access plaintext')
      },
      get signingSecrets(): string[] {
        throw Error('must not access plaintext')
      },
    }
    logger.info(
      {
        safe: 'visible',
        credential,
        request: {
          headers: {
            authorization: 'hidden-a',
            'asaas-access-token': 'hidden-b',
          },
        },
        secrets: [
          {
            wrappedDek: 'hidden-c',
            ciphertext: 'hidden-d',
            accessToken: { apiKey: 'hidden-e' },
          },
        ],
        key: new SecretValue('hidden-f'),
        PLATFORM_SECRETS_KEK_K1: 'hidden-g',
        userAgent: 'hidden-contact@example.invalid',
      },
      'fixture'
    )
    const serialized = output.join('')
    for (const marker of [
      'hidden-a',
      'hidden-b',
      'hidden-c',
      'hidden-d',
      'hidden-e',
      'hidden-f',
      'hidden-g',
      'hidden-contact@example.invalid',
    ])
      expect(serialized).not.toContain(marker)
    expect(JSON.parse(serialized).safe).toBe('visible')
    expect(JSON.parse(serialized).credential.apiKey).toBe('[REDACTED]')
    expect(JSON.parse(serialized).credential.signingSecrets).toBe('[REDACTED]')
  })
})
