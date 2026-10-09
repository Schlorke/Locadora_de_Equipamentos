import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: mocks.queryRaw } }))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $queryRaw: mocks.queryRaw } }),
}))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdmin: mocks.requireAdmin,
  requireAdminOrOperator: mocks.requireAdmin,
  requireRoles: mocks.requireAdmin,
}))

import { GET as health } from '@/app/api/health/route'
import { GET as serviceHealth } from '../../apps/services/api/src/app/api/health/route'
import { GET as dreiProxy } from '@/app/api/drei-proxy/[...path]/route'
import { GET as serviceDreiProxy } from '../../apps/services/api/src/app/api/drei-proxy/[...path]/route'
import { GET as analytics } from '@/app/api/admin/analytics/route'
import { GET as security } from '@/app/api/admin/security/route'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DREI_BASE =
  'https://raw.githubusercontent.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/'
const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden in security tests')
    })
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe.each([
  ['legacy', health],
  ['service', serviceHealth],
] as const)('GET /api/health (anonymous, %s)', (_name, health) => {
  it('keeps the success contract', async () => {
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }])
    const response = await health()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      status: 'healthy',
      timestamp: expect.any(String),
      database: 'connected',
    })
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })

  it('answers a generic 503 and keeps the driver detail only in the structured server log', async () => {
    const detail =
      "P1001: Can't reach database server at `db-internal.example:5432` user=runtime_role password=not-a-real-secret"
    mocks.queryRaw.mockRejectedValue(new Error(detail))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await health()

    expect(response.status).toBe(503)
    const text = await response.text()
    for (const leaked of [
      'P1001',
      'db-internal',
      '5432',
      'runtime_role',
      'not-a-real-secret',
    ])
      expect(text).not.toContain(leaked)
    expect(JSON.parse(text)).toEqual({
      status: 'unhealthy',
      timestamp: expect.any(String),
      database: 'disconnected',
      error: 'Service unavailable',
    })
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]?.[1]).toEqual({
      event: 'health.database_unavailable',
      errorName: 'Error',
      errorMessage: detail,
    })
  })

  it('does not echo non-Error rejections either', async () => {
    mocks.queryRaw.mockRejectedValue(
      'raw driver string with secret-token-value'
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await health()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('secret-token-value')
  })
})

describe.each([
  ['legacy', dreiProxy],
  ['service', serviceDreiProxy],
] as const)('GET /api/drei-proxy/[...path] (%s)', (_host, dreiProxy) => {
  const call = (segments: string[], origin?: string) =>
    dreiProxy(
      new NextRequest(
        'http://localhost/api/drei-proxy/' + segments.join('/'),
        origin ? { headers: { origin } } : undefined
      ),
      { params: Promise.resolve({ path: segments }) }
    )
  const upstream = (status = 200, contentType = 'text/html; charset=utf-8') =>
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array([35, 63, 82, 65, 68]), {
            status,
            headers: { 'content-type': contentType },
          })
      )
    )
  const expectNoCors = (response: Response) => {
    for (const header of CORS_HEADERS)
      expect(response.headers.get(header)).toBeNull()
  }

  it('accepts every HDR path the frontend requests, pinned to the drei-assets commit', async () => {
    const viewer = fs.readFileSync(
      path.join(
        ROOT,
        'packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx'
      ),
      'utf8'
    )
    const requested = [...viewer.matchAll(/'(hdri\/[^']+)'/g)].map(
      (match) => match[1]!
    )
    expect(requested.length).toBeGreaterThan(0)
    for (const asset of requested) {
      upstream()
      const response = await call(asset.split('/'))
      expect(response.status, asset).toBe(200)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(DREI_BASE + asset)
    }
  })

  it('serves an opaque nosniff binary with no CORS grant, whatever the Origin', async () => {
    for (const origin of [
      'https://locacoesgb.com.br',
      'https://www.locacoesgb.com.br',
      'https://outra-locadora.example',
      'null',
    ]) {
      upstream()
      const response = await call(['hdri', 'forest_slope_1k.hdr'], origin)
      expect(response.status).toBe(200)
      expectNoCors(response)
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('content-type')).toBe(
        'application/octet-stream'
      )
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        new Uint8Array([35, 63, 82, 65, 68])
      )
    }
  })

  it.each([
    [['..', 'etc', 'passwd']],
    [['..', '..', 'forest_slope_1k.hdr']],
    [['hdri', '..', 'forest_slope_1k.hdr']],
    [['hdri', '..']],
    [['hdri', '.']],
    [['hdri', '']],
    [['', 'forest_slope_1k.hdr']],
    [['hdri', '', 'forest_slope_1k.hdr']],
    [['hdri']],
    [[]],
    [['hdri', '%2e%2e']],
    [['hdri', '%2E%2E%2Fsecret.hdr']],
    [['hdri', '..%2f..%2fx.hdr']],
    [['hdri', '%252e%252e%252fx.hdr']],
    [['hdri', '../../x.hdr']],
    [['hdri', 'a/../../b.hdr']],
    [['hdri', 'a\\..\\b.hdr']],
    [['hdri', '.hdr']],
    [['hdri', '.hidden.hdr']],
    [['hdri', 'forest_slope_1k.hdr', 'extra']],
    [['hdri', 'forest_slope_1k.hdr?raw=1']],
    [['hdri', 'forest_slope_1k.hdr#x']],
    [['hdri', 'forest\u0000.hdr']],
    [['hdri', 'forest_slope_1k.png']],
    [['HDRI', 'forest_slope_1k.hdr']],
    [['normals', '000.jpg']],
    [['cloud.png']],
    [['..', '..', '..', 'other-owner', 'repo', 'main', 'x.hdr']],
  ])('rejects %j before any upstream request', async (segments) => {
    upstream()
    const response = await call(segments)
    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expectNoCors(response)
  })

  it('propagates an upstream failure without CORS', async () => {
    upstream(404)
    const response = await call(['hdri', 'missing_1k.hdr'], 'https://x.example')
    expect(response.status).toBe(404)
    expectNoCors(response)
  })

  it('hides upstream exceptions behind a generic 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket hang up at internal-proxy:8080')
      })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await call(['hdri', 'forest_slope_1k.hdr'])
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('internal-proxy')
  })
})

describe('retired process-global admin telemetry', () => {
  it.each([
    ['analytics', analytics],
    ['security', security],
  ])(
    'admin/%s answers 410 without authenticating or reading process state',
    async (_name, handler) => {
      const response = await handler()
      expect(response.status).toBe(410)
      expect(await response.json()).toEqual({ error: 'Endpoint retired' })
      expect(mocks.requireAdmin).not.toHaveBeenCalled()
    }
  )
})

// Modules that held process-global, tenant-less telemetry or privileged
// Supabase setup (rpc exec_sql, createBucket). They must have no live importer.
const RETIRED_MODULES = [
  'lib/metrics',
  'lib/api-instrumentation',
  'lib/security-monitoring',
  'lib/storage-policies',
  'lib/supabase-setup',
  'lib/supabase',
]
const SCAN_ROOTS = [
  'app',
  'apps',
  'lib',
  'packages',
  'scripts',
  'tests',
  'middlewares',
  'components',
  'hooks',
  'stores',
  'proxy.ts',
]
const SKIP = new Set([
  'node_modules',
  '.next',
  '.expo',
  '.turbo',
  'dist',
  'build',
  'coverage',
])
const SOURCE = /\.(?:[cm]?[jt]sx?)$/

function sourceFiles(entry: string): string[] {
  const absolute = path.join(ROOT, entry)
  if (!fs.existsSync(absolute)) return []
  if (fs.statSync(absolute).isFile())
    return SOURCE.test(absolute) ? [absolute] : []
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((item) =>
      item.isDirectory()
        ? SKIP.has(item.name)
          ? []
          : sourceFiles(path.join(entry, item.name))
        : SOURCE.test(item.name)
          ? [path.join(absolute, item.name)]
          : []
    )
}

function moduleId(fromFile: string, specifier: string): string | null {
  let target: string
  if (specifier.startsWith('@/')) target = path.join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.'))
    target = path.resolve(path.dirname(fromFile), specifier)
  else return null
  return path
    .relative(ROOT, target)
    .split(path.sep)
    .join('/')
    .replace(/\.(?:[cm]?[jt]sx?)$/, '')
    .replace(/\/index$/, '')
}

function specifiers(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      found.push(node.moduleSpecifier.text)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      found.push(node.arguments[0].text)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ['mock', 'doMock', 'importActual'].includes(node.expression.name.text) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      found.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('orphan privileged modules', () => {
  it('have no live importer anywhere in the runtime, tooling or tests', () => {
    const files = SCAN_ROOTS.flatMap(sourceFiles)
    expect(files.length).toBeGreaterThan(500)
    const offenders: string[] = []
    for (const file of files) {
      const self = moduleId(file, './' + path.basename(file))
      if (self && RETIRED_MODULES.includes(self)) continue
      for (const specifier of specifiers(file)) {
        const id = moduleId(file, specifier)
        if (id && RETIRED_MODULES.includes(id))
          offenders.push(
            `${path.relative(ROOT, file).split(path.sep).join('/')} -> ${specifier}`
          )
      }
    }
    expect(offenders).toEqual([])
  }, 30_000)
})
