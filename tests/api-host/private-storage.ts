import { createServer } from 'node:http'

/** Local Supabase HTTP double; real SDK requests are recorded, never forwarded. */
export async function startPrivateStorageFixture() {
  const requests: Array<{ method: string; path: string; body: unknown }> = []
  let mode = 'ready'
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const raw = Buffer.concat(chunks).toString()
    const path = req.url || ''
    if (path === '/__fixture/requests') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(requests))
      return
    }
    const body = raw
      ? req.headers['content-type']?.includes('application/json')
        ? JSON.parse(raw)
        : { bytes: Buffer.concat(chunks).length }
      : null
    if (path === '/__fixture/mode' && req.method === 'POST') {
      const next = (body as { mode?: string } | null)?.mode
      if (
        !next ||
        !['ready', 'public', 'upload-failure', 'sign-failure'].includes(next)
      ) {
        res.statusCode = 400
        res.end('Invalid fixture mode')
        return
      }
      mode = next
      requests.length = 0
      res.end('{}')
      return
    }
    requests.push({
      method: req.method || '',
      path,
      body:
        req.method === 'POST' &&
        path.startsWith('/storage/v1/object/gb-locacoes-images/')
          ? {
              bytes: Buffer.concat(chunks).length,
              encoded: Buffer.concat(chunks).toString('base64'),
              contentType: req.headers['content-type'],
              cacheControl: req.headers['cache-control'],
              upsert: req.headers['x-upsert'],
            }
          : body,
    })
    const requestedUrl = new URL(path, 'http://fixture.test')
    if (
      req.method === 'GET' &&
      requestedUrl.pathname ===
        '/storage/v1/object/sign/gb-locacoes-client-documents/private-fixture.pdf' &&
      requestedUrl.searchParams.get('token') === 'local-fixture-only'
    ) {
      res.setHeader('content-type', 'application/pdf')
      res.end('%PDF-1.4\n%private fixture\n%%EOF')
      return
    }
    res.setHeader('content-type', 'application/json')
    if (
      req.method === 'GET' &&
      path === '/storage/v1/bucket/gb-locacoes-client-documents'
    ) {
      res.end(
        JSON.stringify({
          name: 'gb-locacoes-client-documents',
          public: mode === 'public',
        })
      )
    } else if (
      req.method === 'POST' &&
      path.startsWith('/storage/v1/object/sign/gb-locacoes-client-documents/')
    ) {
      if (path.includes('unavailable.pdf') || mode === 'sign-failure') {
        res.statusCode = 503
        res.end(JSON.stringify({ error: 'Storage fixture unavailable' }))
        return
      }
      res.end(
        JSON.stringify({
          signedURL:
            '/object/sign/gb-locacoes-client-documents/private-fixture.pdf?token=local-fixture-only',
        })
      )
    } else if (
      req.method === 'POST' &&
      (path.startsWith('/storage/v1/object/gb-locacoes-client-documents/') ||
        path.startsWith('/storage/v1/object/gb-locacoes-images/'))
    ) {
      if (mode === 'upload-failure') {
        res.statusCode = 503
        res.end(JSON.stringify({ error: 'Storage fixture upload unavailable' }))
      } else res.end(JSON.stringify({ Key: path, Id: 'local-object-fixture' }))
    } else if (
      req.method === 'DELETE' &&
      path === '/storage/v1/object/gb-locacoes-client-documents'
    ) {
      res.end('[]')
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Unknown storage fixture request' }))
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No storage fixture port')
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
