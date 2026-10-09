import { createServer } from 'node:http'

/** Um e-mail como o SDK do Resend o envia (`POST /emails`), sem a chave da conta. */
export type CapturedEmail = {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  idempotencyKey: string | null
}

/**
 * Dublê do Resend para a bateria de paridade (onda 135, B9): os hosts recebem `RESEND_BASE_URL` com esta origem de
 * loopback (o SDK instalado lê a variável, `resend/dist/index.cjs`), então todo e-mail real do produto chega aqui e
 * nunca à internet. Só aceita a chave de fixture; outra chave responde 401 como o provedor. Os testes leem o que foi
 * enviado por `GET /__fixture/emails?to=<endereço>`.
 */
export async function startResendFixture(apiKey: string) {
  const emails: CapturedEmail[] = []
  const server = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json')
    const url = new URL(request.url ?? '/', 'http://fixture.invalid')
    if (url.pathname === '/__fixture/emails') {
      const to = url.searchParams.get('to')?.toLowerCase()
      response.end(
        JSON.stringify(
          to ? emails.filter((email) => email.to.includes(to)) : emails
        )
      )
      return
    }
    if (request.method !== 'POST' || url.pathname !== '/emails') {
      response.statusCode = 404
      response.end(JSON.stringify({ name: 'not_found', message: 'Not found' }))
      return
    }
    if (request.headers.authorization !== `Bearer ${apiKey}`) {
      response.statusCode = 401
      response.end(
        JSON.stringify({
          name: 'validation_error',
          message: 'API key is invalid',
        })
      )
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as {
      from?: string
      to?: string | string[]
      subject?: string
      text?: string
      html?: string
    }
    emails.push({
      from: body.from ?? '',
      to: (Array.isArray(body.to) ? body.to : [body.to ?? '']).map((to) =>
        to.toLowerCase()
      ),
      subject: body.subject ?? '',
      text: body.text ?? '',
      html: body.html ?? '',
      idempotencyKey:
        typeof request.headers['idempotency-key'] === 'string'
          ? request.headers['idempotency-key']
          : null,
    })
    response.end(JSON.stringify({ id: `fixture-email-${emails.length}` }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing Resend fixture address')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    },
  }
}

/** E-mails enviados a `to` nesta rodada, na ordem de envio. */
export async function emailsTo(origin: string, to: string) {
  const response = await fetch(
    `${origin}/__fixture/emails?to=${encodeURIComponent(to.toLowerCase())}`
  )
  return (await response.json()) as CapturedEmail[]
}

/** Os links absolutos de um e-mail (texto e HTML), sem duplicatas e sem o escape de HTML. */
export function emailLinks(email: Pick<CapturedEmail, 'text' | 'html'>) {
  const raw = `${email.text}\n${email.html}`
  return [
    ...new Set(
      [...raw.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((match) =>
        match[0].replaceAll('&amp;', '&')
      )
    ),
  ]
}
