import { createServer } from 'node:http'
import { writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/** Owned child processes route fixed Melhor Envio URLs to loopback only. */
export async function startShippingFixture(directory: string) {
  const requests: Array<{
    path: string
    method: string
    authorization: string
    userAgent: string
    providerHost: string
    body: unknown
  }> = []
  const option = {
    id: 1,
    name: 'Local',
    company: { name: 'Carrier' },
    price: '12.50',
    delivery_time: '4',
  }
  const server = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/__fixture/requests') {
      if (req.method === 'DELETE') requests.length = 0
      res.end(JSON.stringify(requests))
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString())
    requests.push({
      path: req.url || '',
      method: req.method || '',
      authorization: req.headers.authorization || '',
      userAgent: String(req.headers['user-agent'] || ''),
      providerHost: String(req.headers['x-fixture-provider-host'] || ''),
      body,
    })
    switch (body.to?.postal_code) {
      case '10000001':
        res.statusCode = 429
        res.end('{"secret":"local-provider-error"}')
        return
      case '10000002':
        res.end('{')
        return
      case '10000003':
        res.end('{"options":[]}')
        return
      case '10000004':
        res.statusCode = 302
        res.setHeader('location', '/should-not-follow')
        res.end('{}')
        return
      case '10000005':
        req.socket.destroy()
        return
      case '10000006':
        res.end(
          JSON.stringify([
            { ...option, custom_price: '0', custom_delivery_time: '0' },
            { ...option, price: '-1' },
            { error: 'unavailable' },
          ])
        )
        return
      case '10000007':
        res.end(JSON.stringify([{ error: 'unavailable' }]))
        return
      case '10000008':
        return // The production 12-second AbortSignal closes this request.
      default:
        res.end(JSON.stringify([option]))
        return
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing shipping fixture address')
  const origin = `http://127.0.0.1:${address.port}`
  const preload = path.join(directory, 'shipping-fetch-preload.cjs')
  writeFileSync(
    preload,
    `const original = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (['melhorenvio.com.br', 'sandbox.melhorenvio.com.br'].includes(url.hostname)) {
    const target = ${JSON.stringify(origin)} + url.pathname + url.search;
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('x-fixture-provider-host', url.hostname);
    return original(input instanceof Request ? new Request(target, input) : target, { ...init, headers });
  }
  if (/melhorenvio\\.com\\.br$/i.test(url.hostname)) throw new Error('External shipping network blocked in parity fixture');
  return original(input, init);
};
`
  )
  return {
    origin,
    preload,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
      rmSync(preload, { force: true })
    },
  }
}
