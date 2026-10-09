import { createServer } from 'node:http'
import { writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/** Owned local provider double. A child-only preload redirects Zoho fetches here. */
export async function startZohoMailFixture(directory: string) {
  const requests: Array<{
    path: string
    method: string
    authorization: string
    body: string
    files?: Array<{ name: string; size: number; bytes: number[] }>
  }> = []
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    res.setHeader('content-type', 'application/json')
    if (url.pathname === '/__fixture/requests') {
      if (req.method === 'DELETE') requests.length = 0
      res.end(JSON.stringify(requests))
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const bytes = Buffer.concat(chunks)
    const entry: (typeof requests)[number] = {
      path: req.url || '',
      method: req.method || '',
      authorization: req.headers.authorization || '',
      body: bytes.toString(),
    }
    if (req.headers['content-type']?.startsWith('multipart/form-data')) {
      const form = await new Request('http://localhost/upload', {
        method: 'POST',
        headers: { 'content-type': req.headers['content-type'] },
        body: bytes,
      }).formData()
      entry.files = await Promise.all(
        form.getAll('attach').map(async (value) => {
          if (!(value instanceof File))
            throw new Error('Unexpected fixture attachment')
          return {
            name: value.name,
            size: value.size,
            bytes: [...new Uint8Array(await value.arrayBuffer())],
          }
        })
      )
    }
    requests.push(entry)
    if (url.pathname === '/zoho/accounts.zoho.com/oauth/v2/token') {
      const form = new URLSearchParams(bytes.toString())
      if (form.get('grant_type') === 'authorization_code') {
        if (
          !['local-oauth-code', 'local-no-account-code'].includes(
            form.get('code') || ''
          )
        ) {
          res.statusCode = 400
          res.end('{"error":"fixture oauth refusal"}')
          return
        }
        res.end(
          JSON.stringify({
            access_token:
              form.get('code') === 'local-no-account-code'
                ? 'local-no-account-access'
                : 'local-access-a',
            refresh_token: 'local-refresh-a',
            expires_in: 3600,
          })
        )
        return
      }
      if (form.get('refresh_token') !== 'local-refresh-a') {
        res.statusCode = 400
        res.end('{"error":"invalid refresh fixture"}')
        return
      }
      res.end('{"access_token":"local-refreshed-a","expires_in":3600}')
      return
    }
    const providerPath = url.pathname.replace('/zoho/mail.zoho.com/api', '')
    if (
      providerPath === '/accounts' &&
      req.headers.authorization === 'Zoho-oauthtoken local-no-account-access'
    ) {
      res.statusCode = 503
      res.end('{"status":{"description":"fixture account discovery failed"}}')
      return
    }
    if (
      ![
        'Zoho-oauthtoken local-access-a',
        'Zoho-oauthtoken local-refreshed-a',
      ].includes(req.headers.authorization || '')
    ) {
      res.statusCode = 401
      res.end('{"status":{"description":"fixture token refused"}}')
      return
    }
    if (
      providerPath.includes('provider-failure') ||
      url.searchParams.get('folderId') === 'provider-failure'
    ) {
      res.statusCode = 429
      res.end('{"status":{"description":"fixture throttled"}}')
      return
    }
    if (
      req.method === 'POST' &&
      providerPath.endsWith('/messages/attachments')
    ) {
      res.end(
        JSON.stringify({
          data: (entry.files ?? []).map((file) => ({
            storeName: 'fixture',
            attachmentName: file.name,
            attachmentPath: 'fixture/' + file.name,
            size: file.size,
          })),
        })
      )
    } else if (
      req.method === 'POST' &&
      /\/messages(?:\/\d+)?$/.test(providerPath)
    ) {
      const body = JSON.parse(entry.body)
      if (body.subject === 'provider-failure') {
        res.statusCode = 429
        res.end('{"status":{"description":"fixture throttled"}}')
      } else {
        res.end(
          '{"status":{"code":200},"data":{"messageId":"9007199254740993130"}}'
        )
      }
    } else if (
      req.method === 'PUT' &&
      providerPath.endsWith('/updatemessage')
    ) {
      res.end('{"status":{"code":200}}')
    } else if (req.method === 'DELETE' && providerPath.includes('/messages/')) {
      res.end('{"status":{"code":200}}')
    } else if (providerPath === '/accounts') {
      // Deliberately unquoted 19-digit IDs exercise the production JSON parser.
      res.end(
        '{"data":[{"accountId":9007199254740993123,"primaryEmailAddress":"mail@example.test"}]}'
      )
    } else if (providerPath === '/accounts/9007199254740993123/folders') {
      res.end(
        '{"data":[{"folderId":9007199254740993124,"folderName":"Inbox","unreadCount":2}]}'
      )
    } else if (providerPath.endsWith('/messages/view')) {
      res.end(
        JSON.stringify({
          data: [
            {
              messageId: '9007199254740993125',
              sender: 'Ana &lt;ana@example.test&gt;',
              status: '0',
              fixtureLimit: url.searchParams.get('limit'),
              fixtureStart: url.searchParams.get('start'),
              fixtureFolder: url.searchParams.get('folderId'),
            },
          ],
        })
      )
    } else if (providerPath.endsWith('/details')) {
      res.end(
        JSON.stringify({
          data: {
            messageId: '9007199254740993125',
            subject: 'Local mail',
            sender: 'Ana <ana@example.test>',
            toAddress: 'Bob <bob@example.test>',
            hasAttachment: '1',
            status: '0',
            receivedTime: '1700000000000',
          },
        })
      )
    } else if (providerPath.endsWith('/content')) {
      res.end(
        JSON.stringify({
          data: {
            content:
              '<img src="cid:logo[1]"><img src="/mail/ImageDisplay?cid=other&amp;f=Other.png">',
          },
        })
      )
    } else if (providerPath.endsWith('/attachmentinfo')) {
      res.end(
        JSON.stringify({
          data: {
            attachments: [
              {
                attachmentId: '9007199254740993126',
                attachmentName: 'Mail.pdf',
                attachmentSize: 5,
              },
            ],
            inline: [
              {
                attachmentId: '9007199254740993127',
                cid: 'logo[1]',
                attachmentName: 'Logo.png',
              },
            ],
          },
        })
      )
    } else if (
      providerPath.includes('/attachments/') ||
      providerPath.endsWith('/inline')
    ) {
      res.setHeader('content-type', 'image/png')
      res.write(Buffer.from([0, 127]))
      res.end(Buffer.from([255, 13, 10]))
    } else {
      res.statusCode = 404
      res.end('{"status":{"description":"unknown provider fixture route"}}')
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing Zoho fixture address')
  const origin = `http://127.0.0.1:${address.port}`
  const preload = path.join(directory, 'zoho-fetch-preload.cjs')
  writeFileSync(
    preload,
    `const original = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const value = input instanceof Request ? input.url : String(input);
  const url = new URL(value);
  if (url.hostname === 'mail.zoho.com' || url.hostname === 'accounts.zoho.com') {
    const target = ${JSON.stringify(origin)} + '/zoho/' + url.hostname + url.pathname + url.search;
    return original(input instanceof Request ? new Request(target, input) : target, init);
  }
  if (/\\.zoho\\./i.test(url.hostname)) throw new Error('External Zoho network blocked in parity fixture');
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
