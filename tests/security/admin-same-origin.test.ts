const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  // Qualquer acesso ao cliente é um efeito (leitura ou escrita no banco).
  const client: object = new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === 'then') return undefined
      state.effects.push(`prisma.${String(property)}`)
      return client
    },
    apply: () => {
      state.effects.push('prisma()')
      return Promise.reject(new Error('database access in a CSRF test'))
    },
  })
  return { prisma: client, default: client }
}
/**
 * CSRF entre locadoras irmãs no painel (lote de endurecimento da onda 4): todo
 * `{slug}.<raiz>` e o `app.<raiz>` são o mesmo site, então um script de
 * `bravo.<raiz>` consegue mandar POST/PUT/PATCH/DELETE para
 * `app.<raiz>/api/admin/**` com o cookie do painel. O guard de mesma origem é
 * central (`resolveTenantPrincipal`, e por ele `requireTenantPermission` e os
 * middlewares de `requireAdmin`): aqui TODA mutação exportada por um Route
 * Handler de `/api/admin/**` é chamada de verdade, com o contexto de borda do
 * host `app` assinado como o proxy do host web o entrega.
 *
 * Sem banco: a sessão e o Prisma são dublês que registram cada acesso. Uma
 * mutação de origem irmã responde 403 sem consultar a sessão nem o banco; a
 * mesma requisição da origem do app, e a de um cliente nativo (sem borda e
 * sem cabeçalhos de navegador), chegam à sessão (controles positivos).
 *
 * A antiga app/api/admin foi retirada em F; a varredura atual roda na API
 * compartilhada (`apps/services/api/src/app/api/admin`), com a sessão do serviço
 * (`host/session`) e o banco do runtime (`getDatabaseRuntime`) como dublês.
 */
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  effects: [] as string[],
  headers: new Headers(),
}))

const recordingClient = vi.hoisted(() => {
  // Qualquer acesso ao cliente é um efeito (leitura ou escrita no banco).
  const client: object = new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === 'then') return undefined
      state.effects.push(`prisma.${String(property)}`)
      return client
    },
    apply: () => {
      state.effects.push('prisma()')
      return Promise.reject(new Error('database access in a CSRF test'))
    },
  })
  return client
})
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  getServerSession: async () => {
    state.effects.push('session')
    return null
  },
}))
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma: recordingClient }),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => state.headers,
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {
      state.effects.push('cookies.set')
    },
    delete: () => {
      state.effects.push('cookies.delete')
    },
  }),
}))

const SECRET = 'edge-secret-admin-same-origin-0123456789'
const ROOT = 'plataforma.test'
const API = 'https://backend.internal'
const APP = `https://app.${ROOT}`
const originOf = (slug: string) => `https://${slug}.${ROOT}`
const appEdge = {
  'x-platform-edge-auth': SECRET,
  'x-platform-host-kind': 'app',
  'x-platform-origin': APP,
}
const MUTATIONS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const
type Handler = (
  _request: NextRequest,
  _context: { params: Promise<Record<string, string>> }
) => Promise<Response>

const ROOT_DIR = path.resolve(__dirname, '../..')
function routeFiles(directory: string): string[] {
  return fs
    .readdirSync(path.join(ROOT_DIR, directory), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? routeFiles(path.join(directory, entry.name))
        : entry.name === 'route.ts'
          ? [path.join(directory, entry.name).split(path.sep).join('/')]
          : []
    )
}

/** Toda mutação exportada por /api/admin/** (os retirados com 410 também são chamados). */
async function adminMutations(
  root: string
): Promise<Array<{ name: string; handler: Handler }>> {
  const found: Array<{ name: string; handler: Handler }> = []
  for (const file of routeFiles(root).sort()) {
    const module = (await import(
      /* @vite-ignore */ path.join(ROOT_DIR, file)
    )) as Record<string, unknown>
    for (const method of MUTATIONS)
      if (typeof module[method] === 'function')
        found.push({
          name: `${method} ${file}`,
          handler: module[method] as Handler,
        })
  }
  return found
}

/** Parâmetros de rota com qualquer nome (`id`, `messageId`...). */
const params = () =>
  Promise.resolve(
    new Proxy({} as Record<string, string>, {
      get: (_target, property) =>
        property === 'then' ? undefined : 'row-alfa',
    })
  )

async function call(
  handler: Handler,
  method: string,
  headers: Record<string, string>
): Promise<Response> {
  state.headers = new Headers(headers)
  state.effects.length = 0
  return handler(
    new NextRequest(`${API}/api/admin/x`, {
      method,
      headers,
      body: JSON.stringify({ name: 'Fixture' }),
    }),
    { params: params() }
  )
}

beforeEach(() => {
  vi.stubEnv('PLATFORM_ENV', 'staging')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
  vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const RETIRED = 410

const ROOTS = [['service', 'apps/services/api/src/app/api/admin']] as const

// A comparação entre a antiga raiz e o serviço foi validada antes da aposentadoria
// da raiz no bloco F. Aqui todos os handlers ativos do serviço mantêm as provas CSRF
// e os controles positivos abaixo; não se compara o serviço consigo mesmo.

describe.each(ROOTS)(
  '%s: every /api/admin/** mutation on the app host refuses a sibling tenant origin',
  (_host, root) => {
    const adminMutationsOfRoot = () => adminMutations(root)
    it('finds the admin mutations of the panel', async () => {
      const all = await adminMutationsOfRoot()
      expect(all.length).toBeGreaterThanOrEqual(50)
      expect(all.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          `POST ${root}/categories/route.ts`,
          `DELETE ${root}/zoho-mail/oauth/disconnect/route.ts`,
          `POST ${root}/notifications/sync/route.ts`,
          `PUT ${root}/settings/route.ts`,
        ])
      )
    }, 120_000)

    it('a script on bravo.<raiz> gets 403 before the session and the database, on every handler', async () => {
      const problems: string[] = []
      for (const { name, handler } of await adminMutationsOfRoot()) {
        const method = name.split(' ')[0]!
        for (const headers of [
          // fetch('https://app.<raiz>/api/admin/...', { credentials: 'include' }) em bravo
          {
            ...appEdge,
            origin: originOf('bravo'),
            'sec-fetch-site': 'same-site',
            'content-type': 'text/plain;charset=UTF-8',
          },
          { ...appEdge, origin: originOf('bravo') },
          { ...appEdge, origin: APP, 'sec-fetch-site': 'same-site' },
        ]) {
          const response = await call(handler, method, headers)
          if (response.status === RETIRED && !state.effects.length) continue
          const body = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          if (
            response.status !== 403 ||
            !/Origem não permitida/.test(body?.error ?? '') ||
            state.effects.length
          )
            problems.push(
              `${name} (${headers.origin ?? headers['sec-fetch-site']}): ${response.status} ${JSON.stringify(body)} effects=${state.effects.join(',')}`
            )
        }
      }
      expect(problems).toEqual([])
    }, 120_000)

    it('the same request from the app origin reaches the session (positive control)', async () => {
      const problems: string[] = []
      for (const { name, handler } of await adminMutationsOfRoot()) {
        const method = name.split(' ')[0]!
        const response = await call(handler, method, {
          ...appEdge,
          origin: APP,
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json',
        })
        if (response.status === RETIRED) continue
        if (response.status === 403 || !state.effects.includes('session'))
          problems.push(
            `${name}: ${response.status} ${state.effects.join(',')}`
          )
      }
      expect(problems).toEqual([])
    }, 120_000)

    it('a native client (no edge, no browser headers) reaches the session as before', async () => {
      const problems: string[] = []
      for (const { name, handler } of await adminMutationsOfRoot()) {
        const method = name.split(' ')[0]!
        const response = await call(handler, method, {
          'content-type': 'application/json',
        })
        if (response.status === RETIRED) continue
        if (response.status === 403 || !state.effects.includes('session'))
          problems.push(
            `${name}: ${response.status} ${state.effects.join(',')}`
          )
      }
      expect(problems).toEqual([])
    }, 120_000)
  }
)
