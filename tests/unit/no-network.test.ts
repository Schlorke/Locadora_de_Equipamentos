import http, { request as namedRequest } from 'node:http'
import https from 'node:https'
import net, { type AddressInfo } from 'node:net'
import tls from 'node:tls'
import { afterEach, describe, expect, it, vi } from 'vitest'
import identityConfig from '../../vitest.identity.config'
import securityConfig from '../../vitest.security.config'
import unitConfig from '../../vitest.unit.config'
import platformConfig from '../../vitest.platform.config'
import contractConfig from '../../vitest.contract.config'

/**
 * tests/helpers/no-network.ts, as the suites load it (setupFiles). This file never imports the helper
 * itself: importing it would install the guard and hide a suite that forgot it.
 */
const blocked = {
  name: 'NetworkBlockedError',
  code: 'ERR_TEST_NETWORK_BLOCKED',
  message: expect.stringContaining('Rede de saída bloqueada nos testes'),
}
/** Hosts that never resolve (.invalid, RFC 2606): without the guard the attempt fails in DNS, never on a third party. */
const OUTSIDE = 'https://sandbox.asaas.invalid/v3/payments'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('test suites block outbound network (tests/helpers/no-network.ts)', () => {
  it('is a setup file of the unit, security, identity, platform and contract suites', () => {
    for (const [name, config] of [
      ['vitest.unit.config.ts', unitConfig],
      ['vitest.security.config.ts', securityConfig],
      ['vitest.identity.config.ts', identityConfig],
      ['vitest.platform.config.ts', platformConfig],
      ['vitest.contract.config.ts', contractConfig],
    ] as const)
      expect(config.test?.setupFiles, name).toContain(
        'tests/helpers/no-network.ts'
      )
  })

  it('rejects fetch to any host but localhost, 127.0.0.1 and ::1, before leaving', async () => {
    for (const input of [
      OUTSIDE,
      new URL('http://api.example.invalid/x'),
      new Request('https://127.0.0.1.example.invalid/'),
      'wss://socket.example.invalid/',
    ])
      await expect(fetch(input), String(input)).rejects.toMatchObject(blocked)
    await expect(
      fetch(OUTSIDE, { method: 'POST', body: '{}' })
    ).rejects.toThrow('fetch para https://sandbox.asaas.invalid')
  })

  it('refuses http, https and raw sockets to the outside, synchronously', () => {
    const attempts: Array<[string, () => unknown]> = [
      ['http.get', () => http.get('http://api.example.invalid/')],
      [
        'http.request (named import)',
        () => namedRequest({ host: 'api.example.invalid', path: '/' }),
      ],
      ['https.request', () => https.request(OUTSIDE)],
      [
        'https.get',
        () =>
          https.get(new URL(OUTSIDE), { hostname: 'other.example.invalid' }),
      ],
      ['net.connect', () => net.connect(443, 'api.example.invalid')],
      [
        'net.connect (options)',
        () => net.connect({ host: 'api.example.invalid', port: 5432 }),
      ],
      [
        'tls.connect',
        () => tls.connect({ host: 'api.example.invalid', port: 443 }),
      ],
    ]
    for (const [label, attempt] of attempts)
      expect(attempt, label).toThrow(expect.objectContaining(blocked))
  })

  it('lets the local machine through: a server on 127.0.0.1 answers fetch and http', async () => {
    const server = http.createServer((_request, response) =>
      response.end('local')
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe(
        'local'
      )
      const body = await new Promise<string>((resolve, reject) =>
        http
          .get({ host: '127.0.0.1', port, path: '/' }, (response) => {
            let text = ''
            response.on('data', (chunk) => (text += chunk))
            response.on('end', () => resolve(text))
          })
          .on('error', reject)
      )
      expect(body).toBe('local')
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('keeps a stubbed fetch (the Asaas double) in charge, and the guard back once it is removed', async () => {
    const double = vi.fn(async () => Response.json({ id: 'pay_1' }))
    vi.stubGlobal('fetch', double)
    expect(await (await fetch(OUTSIDE)).json()).toEqual({ id: 'pay_1' })
    vi.unstubAllGlobals()
    await expect(fetch(OUTSIDE)).rejects.toMatchObject(blocked)
  })
})
