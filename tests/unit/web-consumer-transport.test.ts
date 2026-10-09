import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, it } from 'vitest'
import { requestWeb } from '../api-host/web-consumer'

it('transmits the subdomain Host and its Origin without replacing either with the loopback address', async () => {
  const server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        host: request.headers.host,
        origin: request.headers.origin,
        cookie: request.headers.cookie,
        method: request.method,
        body: Buffer.concat(chunks).toString(),
      })
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address() as AddressInfo
    const response = await requestWeb(`http://127.0.0.1:${port}/connect`, {
      method: 'POST',
      headers: {
        Host: 'app.platform.test',
        Origin: 'https://app.platform.test',
        Cookie: 'fixture=only-local',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ marker: 'synthetic' }),
    })
    expect(await response.json()).toEqual({
      host: 'app.platform.test',
      origin: 'https://app.platform.test',
      cookie: 'fixture=only-local',
      method: 'POST',
      body: JSON.stringify({ marker: 'synthetic' }),
    })
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
