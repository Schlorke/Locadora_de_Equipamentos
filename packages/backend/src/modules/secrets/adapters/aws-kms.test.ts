import { describe, expect, it, vi } from 'vitest'
import type { KMSClient } from '@aws-sdk/client-kms'
import { createAwsKmsKeyEncryption } from './aws-kms'

const arn =
  'arn:aws:kms:sa-east-1:123456789012:key/12345678-1234-1234-1234-123456789abc'
describe('KMS encryption port', () => {
  it('pins immutable key, algorithm and exact AAD for encrypt and decrypt', async () => {
    const dek = Buffer.alloc(32, 10),
      wrapped = Buffer.from('encrypted')
    const send = vi
      .fn()
      .mockResolvedValueOnce({ KeyId: arn, CiphertextBlob: wrapped })
      .mockResolvedValueOnce({ KeyId: arn, Plaintext: dek })
    const provider = createAwsKmsKeyEncryption(arn, { send } as unknown as Pick<
      KMSClient,
      'send'
    >)
    expect(await provider.wrap(dek, 'context')).toEqual({ kekId: arn, wrapped })
    expect(await provider.unwrap(arn, wrapped, 'context')).toBe(dek)
    for (const [command, options] of send.mock.calls) {
      expect(command.input).toMatchObject({
        KeyId: arn,
        EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
        EncryptionContext: { aad: 'context' },
      })
      expect(options.abortSignal).toBeInstanceOf(AbortSignal)
    }
  })
  it.each(['alias/test', arn.replace('sa-east-1', 'us-east-1')])(
    'refuses an alias or another region: %s',
    (invalid) => {
      expect(() =>
        createAwsKmsKeyEncryption(invalid, {} as Pick<KMSClient, 'send'>)
      ).toThrow('SECRET_CONFIGURATION_INVALID')
    }
  )
  it('rejects a mismatched response and clears any returned plaintext', async () => {
    const plaintext = Buffer.alloc(32, 12)
    const send = vi
      .fn()
      .mockResolvedValue({ KeyId: arn + 'wrong', Plaintext: plaintext })
    const provider = createAwsKmsKeyEncryption(arn, { send } as unknown as Pick<
      KMSClient,
      'send'
    >)
    await expect(
      provider.unwrap(arn, Buffer.from('blob'), 'context')
    ).rejects.toThrow('SECRET_UNAVAILABLE')
    expect(plaintext).toEqual(Buffer.alloc(32))
  })
  it('never passes an SDK error with plaintext or credentials to callers', async () => {
    const send = vi
      .fn()
      .mockRejectedValue(new Error('synthetic-credential-marker'))
    const provider = createAwsKmsKeyEncryption(arn, { send } as unknown as Pick<
      KMSClient,
      'send'
    >)
    await expect(provider.wrap(Buffer.alloc(32), 'context')).rejects.toThrow(
      /^SECRET_UNAVAILABLE$/
    )
  })
})
