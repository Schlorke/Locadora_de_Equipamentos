import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createZapSignDocument,
  getZapSignDocument,
  ZapSignRequestError,
} from './zapsign'

const request = vi.fn<typeof fetch>()
const credential = {
  apiKey: 'local-provider-fixture-only',
  environment: 'sandbox' as const,
}
const input = {
  name: 'Contrato',
  pdf: Buffer.from('%PDF-fixture'),
  reference: 'attempt-1',
  signer: { name: 'Cliente', email: 'client@example.test' },
}
beforeEach(() => {
  request.mockReset()
  vi.stubGlobal('fetch', request)
})
afterEach(() => vi.unstubAllGlobals())

describe('ZapSign adapter contract', () => {
  it.each(['sandbox', 'production'] as const)(
    'issues only the explicit %s request, preserving signer restrictions and reference',
    async (environment) => {
      request.mockResolvedValue(
        Response.json({
          token: 'doc-1',
          status: 'pending',
          external_id: input.reference,
        })
      )
      await createZapSignDocument({ ...credential, environment }, input)
      const [url, options] = request.mock.calls[0]!
      expect(url).toBe(
        environment === 'sandbox'
          ? 'https://sandbox.zapsign.com.br/api/v1/docs/'
          : 'https://api.zapsign.com.br/api/v1/docs/'
      )
      expect(options).toMatchObject({
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'Bearer ' + credential.apiKey,
          'Content-Type': 'application/json',
        },
      })
      expect(options?.signal).toBeInstanceOf(AbortSignal)
      expect(JSON.parse(String(options?.body))).toEqual({
        name: input.name,
        base64_pdf: input.pdf.toString('base64'),
        external_id: input.reference,
        lang: 'pt-br',
        signers: [
          {
            ...input.signer,
            lock_email: true,
            send_automatic_email: true,
            send_automatic_whatsapp: false,
          },
        ],
      })
      expect(request).toHaveBeenCalledTimes(1)
    }
  )
  it.each([
    [400, 'REJECTED'],
    [401, 'REJECTED'],
    [422, 'REJECTED'],
    [408, 'UNKNOWN'],
    [409, 'UNKNOWN'],
    [429, 'UNKNOWN'],
    [500, 'UNKNOWN'],
  ] as const)(
    'classifies HTTP %s as %s without retrying POST',
    async (status, outcome) => {
      request.mockResolvedValue(new Response('{}', { status }))
      await expect(
        createZapSignDocument(credential, input)
      ).rejects.toMatchObject({ outcome })
      expect(request).toHaveBeenCalledTimes(1)
    }
  )
  it('treats a transport interruption as UNKNOWN', async () => {
    request.mockRejectedValue(new Error('local interruption'))
    await expect(createZapSignDocument(credential, input)).rejects.toEqual(
      new ZapSignRequestError('UNKNOWN')
    )
    expect(request).toHaveBeenCalledTimes(1)
  })
  it.each(['not-json', '{}'])(
    'treats a successful but invalid provider response as UNKNOWN (%s)',
    async (body) => {
      request.mockResolvedValue(new Response(body))
      await expect(
        createZapSignDocument(credential, input)
      ).rejects.toMatchObject({ outcome: 'UNKNOWN' })
    }
  )
  it.each(['../doc', 'doc?q=x', 'x'.repeat(129)])(
    'refuses unsafe lookup reference %s before requesting',
    async (reference) => {
      await expect(getZapSignDocument(credential, reference)).rejects.toThrow(
        'INVALID_DOCUMENT_REFERENCE'
      )
      expect(request).not.toHaveBeenCalled()
    }
  )
  it('looks up the exact document with authentication and no redirect', async () => {
    request.mockResolvedValue(
      Response.json({ token: 'doc_1', status: 'signed' })
    )
    expect(await getZapSignDocument(credential, 'doc_1')).toEqual({
      token: 'doc_1',
      status: 'signed',
    })
    expect(request.mock.calls[0]).toEqual([
      'https://sandbox.zapsign.com.br/api/v1/docs/doc_1/',
      expect.objectContaining({
        headers: { Authorization: 'Bearer ' + credential.apiKey },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    ])
  })
  it('does not accept a failed lookup as a document', async () => {
    request.mockResolvedValue(new Response('{}', { status: 503 }))
    await expect(getZapSignDocument(credential, 'doc-1')).rejects.toThrow(
      'SIGNATURE_LOOKUP_FAILED'
    )
  })
})
