import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { ApiParityContext } from './global-setup'
import { recordParityHit } from './parity-record'
import {
  cleanupOwnedResources,
  stopOwnedProcess,
} from '../helpers/owned-process'

/** Node fetch discards Host overrides; use HTTP for real subdomain requests on loopback. */
export async function requestWeb(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  // Encode FormData with the real Web Request implementation, including its
  // generated boundary. Only the HTTP transport changes to preserve Host.
  const payload = new Request(url, init)
  const body = payload.body
    ? Buffer.from(await payload.arrayBuffer())
    : undefined
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: payload.method,
        headers: Object.fromEntries(payload.headers),
      },
      (result) => {
        const chunks: Buffer[] = []
        result.on('data', (chunk: Buffer) => chunks.push(chunk))
        result.once('error', reject)
        result.once('end', () => {
          const headers = new Headers()
          for (const [name, values] of Object.entries(result.headers)) {
            for (const value of Array.isArray(values)
              ? values
              : values === undefined
                ? []
                : [values])
              headers.append(name, value)
          }
          resolve(
            new Response(
              payload.method === 'HEAD' ||
                [204, 205, 304].includes(result.statusCode ?? 500)
                ? null
                : Buffer.concat(chunks),
              {
                status: result.statusCode ?? 500,
                headers,
              }
            )
          )
        })
      }
    )
    request.once('error', reject)
    request.setTimeout(10000, () =>
      request.destroy(new Error('Owned web request timed out'))
    )
    request.end(body)
  })
}

/** Real Next web proxy against the existing disposable API fixture. No production domain or scheduler. */
export async function startWebConsumer(
  context: ApiParityContext,
  target: string
) {
  const backend = new URL(target)
  if (backend.hostname !== '127.0.0.1' || backend.protocol !== 'http:') {
    throw new Error('Web consumer fixture accepts only the owned loopback API.')
  }
  const temp = mkdtempSync(path.join(tmpdir(), 'locadora-web-consumer-'))
  const certificate = path.join(temp, 'localhost-cert.pem')
  const key = path.join(temp, 'localhost-key.pem')
  const windowsOpenSsl = 'C:/Program Files/Git/usr/bin/openssl.exe'
  const openssl =
    process.platform === 'win32' && existsSync(windowsOpenSsl)
      ? windowsOpenSsl
      : 'openssl'
  // Ephemeral localhost certificate, trusted ONLY by this child with NODE_EXTRA_CA_CERTS.
  // Never disable TLS verification or write keys/certificates to the repository.
  await promisify(execFile)(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      certificate,
    ],
    { timeout: 15000 }
  )
  const forwarded: string[] = []
  const bridge = https.createServer(
    { cert: readFileSync(certificate), key: readFileSync(key) },
    (request, response) => {
      forwarded.push(request.url ?? '/')
      const upstream = http.request(
        new URL(request.url ?? '/', backend),
        {
          method: request.method,
          headers: { ...request.headers, host: backend.host },
        },
        (result) => {
          // Registro da paridade (B3): o pedido que o host web encaminhou chega à API (ou à raiz) com este status.
          recordParityHit(
            backend.origin,
            request.method ?? 'GET',
            request.url ?? '/',
            result.statusCode ?? 502,
            'web'
          )
          response.writeHead(result.statusCode ?? 502, result.headers)
          result.pipe(response)
        }
      )
      upstream.once('error', () => {
        response.writeHead(502)
        response.end()
      })
      request.pipe(upstream)
    }
  )
  let child: ChildProcess | undefined
  let log: number | undefined
  async function stop() {
    await cleanupOwnedResources(
      [
        () => stopOwnedProcess(child),
        () => bridge.closeAllConnections(),
        async () => {
          if (bridge.listening)
            await new Promise<void>((resolve, reject) =>
              bridge.close((error) => (error ? reject(error) : resolve()))
            )
        },
        () => {
          if (log !== undefined) {
            closeSync(log)
            log = undefined
          }
        },
        ...[key, certificate].map((file) => () => {
          if (existsSync(file)) unlinkSync(file)
        }),
      ],
      `Owned web cleanup failed (child PID: ${child?.pid ?? 'not started'})`
    )
  }
  try {
    await new Promise<void>((resolve, reject) => {
      bridge.once('error', reject)
      bridge.listen(0, '127.0.0.1', resolve)
    })
    const address = bridge.address()
    if (!address || typeof address === 'string')
      throw new Error('No TLS fixture port')
    const probe = net.createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const webAddress = probe.address()
    if (!webAddress || typeof webAddress === 'string')
      throw new Error('No web fixture port')
    const webPort = webAddress.port
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    // NextURL normalizes loopback IPs to localhost. Use the same hostname in
    // next start and requests, so internal rewrites stay internal in Next 16.
    const origin = `http://localhost:${webPort}`
    log = openSync(path.join(temp, 'web.log'), 'w')
    child = spawn(
      process.execPath,
      [
        path.resolve('node_modules/next/dist/bin/next'),
        'start',
        '--hostname',
        'localhost',
        '--port',
        String(webPort),
      ],
      {
        cwd: path.resolve('apps/clients/web'),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NEXT_TELEMETRY_DISABLED: '1',
          PLATFORM_ENV: 'production',
          PLATFORM_ROOT_DOMAIN: 'platform.test',
          PLATFORM_EDGE_SECRET: context.secret,
          PLATFORM_RATE_LIMIT_SECRET: context.directory.secret,
          WEB_API_ORIGIN: `https://127.0.0.1:${address.port}`,
          NEXT_PUBLIC_AUTH_MODE: context.identity.mode,
          NODE_EXTRA_CA_CERTS: certificate,
          DATABASE_URL:
            'postgresql://unused:unused@127.0.0.1:1/web_has_no_database',
          DIRECT_URL:
            'postgresql://unused:unused@127.0.0.1:1/web_has_no_database',
          VERCEL_ENV: undefined,
          VERCEL: undefined,
        },
        stdio: ['ignore', log, log],
      }
    )
    let startupError: Error | undefined
    child.once('error', (error) => {
      startupError = error
    })
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      if (startupError || child.exitCode !== null)
        throw startupError ?? new Error(`Owned web exited; inspect ${temp}`)
      try {
        const response = await requestWeb(`${origin}/favicon.ico`, {
          headers: { Host: 'app.platform.test' },
        })
        if (response.status === 200) {
          console.info(
            `Web consumer: owned Next start -> ${target}; logs ${temp}`
          )
          return { origin, forwarded, stop }
        }
        await response.arrayBuffer()
      } catch {
        /* Wait only for this live child. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Owned web did not start; inspect ${temp}`)
  } catch (error) {
    await stop()
    throw error
  }
}
