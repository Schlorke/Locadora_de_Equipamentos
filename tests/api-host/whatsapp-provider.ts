import { createServer, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/** Redirects Graph fetches only in the owned test children; no Meta traffic. */
export async function startWhatsAppFixture(directory: string) {
  const requests: Array<{
    path: string
    method: string
    authorization: string
    body: string
    providerMessageId: string
  }> = []
  const held = new Map<string, ServerResponse>()
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    res.setHeader('content-type', 'application/json')
    if (url.pathname === '/__fixture/requests') {
      if (req.method === 'DELETE') requests.length = 0
      res.end(JSON.stringify(requests))
      return
    }
    if (url.pathname === '/__fixture/release') {
      const id = url.searchParams.get('id') || ''
      held.get(id)?.end(JSON.stringify({ messages: [{ id }] }))
      held.delete(id)
      res.end('{}')
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = Buffer.concat(chunks).toString()
    const providerMessageId = 'local-meta-' + randomUUID()
    requests.push({
      path: req.url || '',
      method: req.method || '',
      authorization: req.headers.authorization || '',
      body,
      providerMessageId,
    })
    const text = JSON.parse(body).text?.body as string
    if (text === 'local-provider-refused') {
      res.statusCode = 429
      res.end('{"error":"local-provider-refused"}')
    } else if (text === 'local-provider-no-id') {
      res.end('{"messages":[]}')
    } else if (text === 'local-provider-invalid-json') {
      res.end('{')
    } else if (text === 'local-provider-network-error') {
      req.socket.destroy()
    } else if (text === 'local-provider-hold') {
      held.set(providerMessageId, res)
    } else if (/^\/v21\.0\/\d+\/messages$/.test(url.pathname)) {
      res.end(JSON.stringify({ messages: [{ id: providerMessageId }] }))
    } else {
      res.statusCode = 404
      res.end('{}')
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing WhatsApp fixture address')
  const origin = `http://127.0.0.1:${address.port}`
  const preload = path.join(directory, 'whatsapp-fetch-preload.cjs')
  writeFileSync(
    preload,
    `const original = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'graph.facebook.com') {
    const target = ${JSON.stringify(origin)} + url.pathname + url.search;
    return original(input instanceof Request ? new Request(target, input) : target, init);
  }
  if (/facebook\\.com$/i.test(url.hostname)) throw new Error('External Meta network blocked in parity fixture');
  return original(input, init);
};
`
  )
  return {
    origin,
    preload,
    async close() {
      for (const response of held.values()) response.destroy()
      held.clear()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
      rmSync(preload, { force: true })
    },
  }
}
