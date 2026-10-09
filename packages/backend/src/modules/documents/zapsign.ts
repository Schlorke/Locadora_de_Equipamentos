import { z } from 'zod'

export type ZapSignCredential = {
  apiKey: string
  environment: 'sandbox' | 'production'
}
export class ZapSignRequestError extends Error {
  constructor(readonly outcome: 'REJECTED' | 'UNKNOWN') {
    super('SIGNATURE_PROVIDER_' + outcome)
  }
}
const Document = z.object({
  token: z.string().min(1),
  status: z.string(),
  external_id: z.string().nullable().optional(),
  signed_file: z.string().url().nullable().optional(),
  signers: z
    .array(z.object({ sign_url: z.string().url().optional() }))
    .optional(),
})
function endpoint(credential: ZapSignCredential) {
  return credential.environment === 'sandbox'
    ? 'https://sandbox.zapsign.com.br/api/v1/docs/'
    : 'https://api.zapsign.com.br/api/v1/docs/'
}
export async function createZapSignDocument(
  credential: ZapSignCredential,
  input: {
    name: string
    pdf: Buffer
    reference: string
    signer: { name: string; email: string }
  }
) {
  let response: Response
  try {
    response = await fetch(endpoint(credential), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        base64_pdf: input.pdf.toString('base64'),
        external_id: input.reference,
        signers: [
          {
            ...input.signer,
            lock_email: true,
            send_automatic_email: true,
            send_automatic_whatsapp: false,
          },
        ],
        lang: 'pt-br',
      }),
    })
  } catch {
    throw new ZapSignRequestError('UNKNOWN')
  }
  if (!response.ok)
    throw new ZapSignRequestError(
      response.status >= 400 &&
        response.status < 500 &&
        ![408, 409, 429].includes(response.status)
        ? 'REJECTED'
        : 'UNKNOWN'
    )
  try {
    return Document.parse(await response.json())
  } catch {
    throw new ZapSignRequestError('UNKNOWN')
  }
}
export async function getZapSignDocument(
  credential: ZapSignCredential,
  externalId: string
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(externalId))
    throw new Error('INVALID_DOCUMENT_REFERENCE')
  const response = await fetch(
    endpoint(credential) + encodeURIComponent(externalId) + '/',
    {
      headers: { Authorization: `Bearer ${credential.apiKey}` },
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    }
  )
  if (!response.ok) throw new Error('SIGNATURE_LOOKUP_FAILED')
  return Document.parse(await response.json())
}
