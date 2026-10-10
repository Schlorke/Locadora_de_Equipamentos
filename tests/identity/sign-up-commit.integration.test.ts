import { getDatabaseRuntime as getFPreparedDatabaseRuntime } from '@gb-locacoes/backend/runtime'
// Achado 8, regressão da primeira correção: o link de verificação consulta os vínculos da conta
// (`accountLinkOrigin`), e o cadastro do Better Auth chama o envio DENTRO da transação que cria o usuário
// (`runWithTransaction` do `/sign-up/email`), que segura uma conexão do pool até o fim. A consulta, pelo cliente
// global, esperava outra conexão; a antiga `lib/prisma.ts`, retirada em F, montava um pool de 1 (2 no transaction pooler :6543). Resultado no host
// de locadora: a transação expirava em 5 s, a conta não nascia, e o e-mail com o link saía assim mesmo, para uma
// conta que não existe. A resposta neutra (202) escondia tudo do cliente.
// Agora o envio (consulta + e-mail) espera o COMMIT: roda com a conexão já devolvida e só para conta confirmada.
// Caminho real: rota /api/auth/register do host API → identity do backend → Better Auth → runtime/database do backend
// (com o pool que ele cria, max 1 fora do :6543) apontado para o PostgreSQL descartável.
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { PLATFORM, PLATFORM_EDGE_HEADER } from '@gb-locacoes/contracts/platform'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  // Tarefas entregues a `after`: rodam só quando o teste manda, depois da resposta.
  pending: [] as Array<() => unknown>,
  databaseUrl: undefined as string | undefined,
}))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    mocks.pending.push(task)
  },
}))

const { prisma } = getFPreparedDatabaseRuntime()
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade da raiz foi retirada no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const { requireTestDatabase } = await import('../helpers/test-database')
  // O módulo de produção, sem dublê: o pool é o que ele monta para a URL (max 1 fora do :6543).
  const target = requireTestDatabase(process.env)
  mocks.databaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = target

  return (async (importOriginal: <T = unknown>() => Promise<T>) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    // O banco é o runtime real do backend, sobre o banco descartável, sem fachada da raiz.
    ...(await (async () => {
      const F = await (() => ({
        default: () => ({ emails: { send: mocks.send } }),
      }))()
      return { createResendClient: () => F.default() }
    })()),
  }))(importOriginal)
})

import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/register/route'

const HOSTS = [
  [
    'service',
    {
      register: serviceRoute0.POST,
    },
  ],
] as const

type ProductionGlobals = typeof globalThis & {
  __pool?: { options: { max?: number }; end(): Promise<void> }
  __prisma?: unknown
}
const productionGlobals = globalThis as ProductionGlobals

const EDGE_SECRET = 'fixture-edge-secret-with-more-than-32-chars'
const ROOT = 'plataforma.example'
const APP = `https://app.${ROOT}`
const BACKEND = 'https://backend.example'
const fixture = randomUUID()
const slug = `commit-${fixture.slice(0, 8)}`
const TENANT = `https://${slug}.${ROOT}`
const tenantId = `sign-up-commit-${fixture}`
const password = 'sign-up-commit-fixture-password'
const env = {
  AUTH_MODE: 'better-auth',
  AUTH_V2_ENABLED: 'false',
  AUTH_CREDENTIAL_WRITES_PAUSED: 'false',
  BETTER_AUTH_URL: APP,
  BETTER_AUTH_SECRET: 'fixture-sign-up-commit-identity-secret-more-than-32',
  AUTH_TRUSTED_ORIGINS: `${PLATFORM.appScheme}://`,
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: ROOT,
  PLATFORM_EDGE_SECRET: EDGE_SECRET,
  PLATFORM_RATE_LIMIT_SECRET: `fixture-rate-limit-${randomUUID()}`,
  WEB_API_ORIGIN: BACKEND,
  FROM_EMAIL: 'identidade@example.test',
}
const addresses: string[] = []
const addressFor = (label: string) => {
  const address = `sign-up-commit-${label}-${fixture}@example.test`
  addresses.push(address)
  return address
}

type Host = 'tenant' | 'app'
let requests = 0

/** POST de cadastro no host `host`, como chega ao backend depois do proxy do host web. */
function registration(host: Host, address: string) {
  const origin = host === 'app' ? APP : TENANT
  return new NextRequest(`${BACKEND}/api/auth/register`, {
    method: 'POST',
    headers: {
      [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
      [PLATFORM_EDGE_HEADER.hostKind]: host,
      [PLATFORM_EDGE_HEADER.origin]: origin,
      ...(host === 'tenant' ? { [PLATFORM_EDGE_HEADER.tenantSlug]: slug } : {}),
      [PLATFORM_EDGE_HEADER.clientIp]: `2001:db8:${fixture.slice(0, 4)}:${(++requests).toString(16)}::1`,
      origin,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Cadastro com commit',
      email: address,
      password,
      phone: '11999990000',
      cpf: `cpf-${address}`,
    }),
  })
}

/** Executa, ao mesmo tempo, o que as rotas deixaram para depois da resposta. */
async function runAfterResponse() {
  const tasks = mocks.pending.splice(0)
  await Promise.all(tasks.map((task) => task()))
}

const accounts = (address: string) =>
  prisma.user.count({ where: { email: address } })
const mailedTo = (address: string) =>
  mocks.send.mock.calls
    .map(([message]) => message as { to: string; text: string })
    .filter((message) => message.to === address)
const linkOf = (text: string) => new URL(text.split('\n').at(-1)!)
/** Quantas contas com o destinatário existiam, vistas de outra conexão, no instante de cada envio. */
const visibleAtSend = new Map<string, number>()

/** Gatilho que recusa o COMMIT de uma conta do caso de rollback (nome único por execução). */
const refuseCommit = `sign_up_commit_refuse_${fixture.replace(/-/g, '')}`
const dropRefuseCommit = async () => {
  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS ${refuseCommit} ON users`
  )
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${refuseCommit}()`)
}

let logged: ReturnType<typeof vi.spyOn>
const failures = () =>
  logged.mock.calls.filter(
    ([tag, fields]) =>
      tag === '[identity]' &&
      (fields as { event?: string }).event === 'registration_failed'
  )

beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  // O pool é o de produção para a URL de sessão (não :6543): uma conexão só.
  expect(productionGlobals.__pool?.options.max).toBe(1)
  await prisma.organization.create({
    data: { id: tenantId, slug, name: 'Locadora Commit' },
  })
})
beforeEach(() => {
  mocks.pending.length = 0
  visibleAtSend.clear()
  mocks.send.mockReset()
  mocks.send.mockImplementation(async (message: { to: string }) => {
    visibleAtSend.set(message.to, await accounts(message.to))
    return { data: { id: 'fixture' }, error: null }
  })
  logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  logged.mockRestore()
})
afterAll(async () => {
  await runFPreparedCleanup(
    async () => {
      vi.restoreAllMocks()
      await dropRefuseCommit()
      await prisma.user.deleteMany({ where: { email: { in: addresses } } })
      await prisma.organization.deleteMany({ where: { id: tenantId } })
    },
    () => prisma.$disconnect(),
    async () => {
      await productionGlobals.__pool?.end()
    },
    () => {
      delete productionGlobals.__pool
    },
    () => {
      delete productionGlobals.__prisma
    },
    () => {
      if (mocks.databaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = mocks.databaseUrl
    },
    () => {
      vi.unstubAllEnvs()
    }
  )
})

// O pool e o cliente de produção são do processo: os ganchos acima ficam no nível do arquivo e cada host roda o cadastro.
describe.each(HOSTS)('%s', (_host, { register }) => {
  describe('cadastro (better-auth) com o pool de produção: o link de verificação sai depois do commit', () => {
    it('host da locadora: a conta nasce, e o link na origem da locadora sai com ela já confirmada', async () => {
      const address = addressFor('tenant')
      const response = await register(registration('tenant', address))
      expect(response.status).toBe(202)
      await runAfterResponse()
      expect(failures()).toEqual([])
      expect(await accounts(address)).toBe(1)
      const mails = mailedTo(address)
      expect(mails).toHaveLength(1)
      // Outra consulta, com a única conexão do pool, já enxergava a conta no envio: o commit veio antes.
      expect(visibleAtSend.get(address)).toBe(1)
      const link = linkOf(mails[0]!.text)
      expect(link.origin).toBe(TENANT)
      expect(link.pathname).toBe('/api/auth/verify-email')
    }, 30_000)

    it('dois cadastros ao mesmo tempo no host da locadora, com a única conexão: os dois nascem, cada um com o seu link', async () => {
      const first = addressFor('first')
      const second = addressFor('second')
      for (const address of [first, second])
        expect((await register(registration('tenant', address))).status).toBe(
          202
        )
      await runAfterResponse()
      expect(failures()).toEqual([])
      for (const address of [first, second]) {
        expect(await accounts(address)).toBe(1)
        expect(mailedTo(address)).toHaveLength(1)
        expect(visibleAtSend.get(address)).toBe(1)
        expect(linkOf(mailedTo(address)[0]!.text).origin).toBe(TENANT)
      }
    }, 60_000)

    it('transação do cadastro que não confirma: nenhum e-mail para a conta que não existe', async () => {
      const address = addressFor('rollback')
      // Gatilho de restrição adiado (só nesta conta, só no banco descartável): o INSERT passa, o motor faz todo o
      // trabalho dele dentro da transação, e o COMMIT é recusado no fim.
      await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${refuseCommit}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.email = '${address}' THEN
          RAISE EXCEPTION 'fixture: commit recusado';
        END IF;
        RETURN NULL;
      END $$`)
      await prisma.$executeRawUnsafe(`
      CREATE CONSTRAINT TRIGGER ${refuseCommit} AFTER INSERT ON users
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${refuseCommit}()`)
      try {
        expect((await register(registration('tenant', address))).status).toBe(
          202
        )
        await runAfterResponse()
      } finally {
        await dropRefuseCommit()
      }
      expect(await accounts(address)).toBe(0)
      expect(mailedTo(address)).toEqual([])
      // A falha só no log, pelo nome, sem o endereço.
      expect(failures()).toHaveLength(1)
      expect(JSON.stringify(failures())).not.toContain(address)
    }, 30_000)

    it('controle no app: conta e link no app, sem consulta de vínculos', async () => {
      const address = addressFor('app')
      expect((await register(registration('app', address))).status).toBe(202)
      await runAfterResponse()
      expect(failures()).toEqual([])
      expect(await accounts(address)).toBe(1)
      expect(visibleAtSend.get(address)).toBe(1)
      expect(linkOf(mailedTo(address)[0]!.text).origin).toBe(APP)
    }, 30_000)
  })
})

// Close all owned siblings and restore process state; cleanup errors stay fatal.
async function runFPreparedCleanup(
  ...steps: Array<() => unknown | Promise<unknown>>
) {
  const errors: unknown[] = []
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length)
    throw new AggregateError(errors, 'F fixture cleanup failed')
}
