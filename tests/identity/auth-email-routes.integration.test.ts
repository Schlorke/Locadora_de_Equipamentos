// H6 (known-issues 180): as rotas próprias /api/auth/forgot-password e /api/auth/register, no modo better-auth.
// Caminho real: route handler → lib/identity → Better Auth → Prisma no PostgreSQL descartável, com a requisição
// chegando ao backend como o proxy do host web a entrega (URL do backend + contexto de borda assinado + Origin).
// Achados 5 e 8 da revisão da onda 4:
// - resposta NEUTRA: mesmo status e corpo para e-mail existente ou não, documento em uso ou falha do motor, e
//   decidida antes de qualquer busca, gravação ou envio (o trabalho sai do caminho da resposta, por `after`);
// - orçamento silencioso de e-mails de recuperação por conta, como no legado;
// - o link sai na origem da locadora só para o cliente dela; equipe e conta sem vínculo recebem o link do app.
// Achado 106 da revisão adversarial: a entrega da verificação que falha depois do commit não é falha de cadastro,
// e repetir o cadastro da conta ainda sem verificar reenvia o link, com orçamento silencioso por conta.
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  afterAll,
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
}))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/prisma', async () => {
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})
vi.mock('@/lib/resend', () => ({
  default: () => ({ emails: { send: mocks.send } }),
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    mocks.pending.push(task)
  },
}))

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { handleIdentityRequest as legacyHandleIdentityRequest } from '@/lib/identity'
import { handleIdentityRequest as serviceHandleIdentityRequest } from '../../apps/services/api/src/host/session'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
  ...(await (async () => {
    const F = await (() => ({
      default: () => ({ emails: { send: mocks.send } }),
    }))()
    return { createResendClient: () => F.default() }
  })()),
}))
import * as legacyRoute0 from '@/app/api/auth/forgot-password/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/forgot-password/route'
import * as legacyRoute1 from '@/app/api/auth/register/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/auth/register/route'

const HOSTS = [
  [
    'legacy root',
    {
      handleIdentityRequest: legacyHandleIdentityRequest,
      forgotPassword: legacyRoute0.POST,
      register: legacyRoute1.POST,
    },
  ],
  [
    'service',
    {
      handleIdentityRequest: serviceHandleIdentityRequest,
      forgotPassword: serviceRoute0.POST,
      register: serviceRoute1.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { handleIdentityRequest, forgotPassword, register }) => {
    const EDGE_SECRET = 'fixture-edge-secret-with-more-than-32-chars'
    const ROOT = 'plataforma.example'
    const APP = `https://app.${ROOT}`
    const BACKEND = 'https://backend.example'
    const fixture = randomUUID()
    const slug = `alfa-${fixture.slice(0, 8)}`
    const TENANT = `https://${slug}.${ROOT}`
    const tenantId = `email-routes-${fixture}`
    const email = `email-routes-${fixture}@example.test`
    const staffEmail = `email-routes-staff-${fixture}@example.test`
    const budgetEmail = `email-routes-budget-${fixture}@example.test`
    const signupEmail = `email-routes-signup-${fixture}@example.test`
    const takenCpfEmail = `email-routes-taken-cpf-${fixture}@example.test`
    const takenCpf = `cpf-taken-${fixture}`
    // Achado 106: conta cujo e-mail de verificação não saiu, e conta que pede o reenvio.
    const undeliveredEmail = `email-routes-undelivered-${fixture}@example.test`
    const resendEmail = `email-routes-resend-${fixture}@example.test`
    const password = 'email-routes-fixture-password'
    const env = {
      AUTH_MODE: 'better-auth',
      AUTH_V2_ENABLED: 'false',
      AUTH_CREDENTIAL_WRITES_PAUSED: 'false',
      BETTER_AUTH_URL: APP,
      BETTER_AUTH_SECRET: 'fixture-email-routes-identity-secret-more-than-32',
      AUTH_TRUSTED_ORIGINS: `${PLATFORM.appScheme}://`,
      PLATFORM_ENV: 'production',
      PLATFORM_ROOT_DOMAIN: ROOT,
      PLATFORM_EDGE_SECRET: EDGE_SECRET,
      // Produção: sem ela os limitadores de identidade recusam (os dois ramos contam as tentativas).
      PLATFORM_RATE_LIMIT_SECRET: `fixture-rate-limit-${randomUUID()}`,
      WEB_API_ORIGIN: BACKEND,
      FROM_EMAIL: 'identidade@example.test',
      // A marca vem de platform.json; a variável antiga não pode mais trocá-la.
      PLATFORM_NAME: 'Marca Antiga Fixture',
    }

    type Host = 'tenant' | 'app'
    let requests = 0

    /** POST de navegador no host `host`, como chega ao backend depois do proxy do host web (IP do cliente pela borda). */
    function post(host: Host, path: string, body: unknown) {
      const origin = host === 'app' ? APP : TENANT
      return new NextRequest(`${BACKEND}${path}`, {
        method: 'POST',
        headers: {
          [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
          [PLATFORM_EDGE_HEADER.hostKind]: host,
          [PLATFORM_EDGE_HEADER.origin]: origin,
          ...(host === 'tenant'
            ? { [PLATFORM_EDGE_HEADER.tenantSlug]: slug }
            : {}),
          [PLATFORM_EDGE_HEADER.clientIp]: `2001:db8:${fixture.slice(0, 4)}:${(++requests).toString(16)}::1`,
          origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    }

    /** Executa o que a rota deixou para depois da resposta. */
    async function flush() {
      while (mocks.pending.length) await mocks.pending.shift()!()
    }

    const lastMail = () =>
      mocks.send.mock.calls.at(-1)?.[0] as { subject: string; text: string }
    const linkOf = (text: string) => new URL(text.split('\n').at(-1)!)

    const startedAt = new Date()
    beforeAll(async () => {
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
      const hash = await bcrypt.hash(password, 12)
      await prisma.organization.create({
        data: { id: tenantId, slug, name: 'Locadora Alfa' },
      })
      for (const [address, role, cpf] of [
        [email, 'CLIENT', null],
        [staffEmail, 'ADMIN', null],
        [takenCpfEmail, 'CLIENT', takenCpf],
        [budgetEmail, 'CLIENT', null],
      ] as const) {
        const user = await prisma.user.create({
          data: {
            email: address,
            name: 'Rotas de e-mail',
            password: hash,
            authEmailVerified: true,
            cpf,
          },
        })
        await prisma.authAccount.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: 'credential',
            password: hash,
          },
        })
        await prisma.membership.create({
          data: { tenantId, userId: user.id, role },
        })
      }
    })
    beforeEach(() => {
      mocks.pending.length = 0
      mocks.send.mockReset()
      mocks.send.mockResolvedValue({ data: { id: 'fixture' }, error: null })
    })
    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { tenantId } })
      await prisma.membership.deleteMany({ where: { tenantId } })
      await prisma.organization.deleteMany({ where: { id: tenantId } })
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              email,
              staffEmail,
              budgetEmail,
              signupEmail,
              takenCpfEmail,
              `outro-${signupEmail}`,
              undeliveredEmail,
              resendEmail,
            ],
          },
        },
      })
      await prisma.authVerification.deleteMany({
        where: { createdAt: { gte: startedAt } },
      })
      vi.unstubAllEnvs()
    })

    describe('POST /api/auth/forgot-password (better-auth)', () => {
      it('cliente da locadora pedindo no host dela: link para a página de redefinição da locadora, com a marca da plataforma', async () => {
        const response = await forgotPassword(
          post('tenant', '/api/auth/forgot-password', { email })
        )
        expect(response.status).toBe(200)
        await flush()
        expect(mocks.send).toHaveBeenCalledTimes(1)
        const mail = lastMail()
        expect(mail.subject).toBe(
          `Recuperação de senha - ${PLATFORM.displayName}`
        )
        const link = linkOf(mail.text)
        expect(link.origin).toBe(TENANT)
        expect(link.pathname).toBe('/reset-password')
        expect(link.searchParams.get('token')).toMatch(/^\S{16,}$/)
      })

      it('pedido no host app: link para o app', async () => {
        const response = await forgotPassword(
          post('app', '/api/auth/forgot-password', { email })
        )
        expect(response.status).toBe(200)
        await flush()
        expect(linkOf(lastMail().text).origin).toBe(APP)
      })

      it('equipe da locadora pedindo no host dela: link para o app (conta global)', async () => {
        await forgotPassword(
          post('tenant', '/api/auth/forgot-password', { email: staffEmail })
        )
        await flush()
        expect(mocks.send).toHaveBeenCalledTimes(1)
        expect(linkOf(lastMail().text).origin).toBe(APP)
      })

      it('e-mail existente ou não: mesma resposta, dada antes de qualquer busca, token ou envio', async () => {
        const answers = []
        for (const address of [staffEmail, `ninguem-${fixture}@example.test`]) {
          const before = await prisma.authVerification.count({
            where: { createdAt: { gte: startedAt } },
          })
          const response = await forgotPassword(
            post('tenant', '/api/auth/forgot-password', { email: address })
          )
          // A resposta saiu e nada do motor rodou: nem token gravado nem e-mail.
          expect(mocks.pending).toHaveLength(1)
          expect(mocks.send).not.toHaveBeenCalled()
          expect(
            await prisma.authVerification.count({
              where: { createdAt: { gte: startedAt } },
            })
          ).toBe(before)
          answers.push({ status: response.status, body: await response.json() })
          await flush()
          mocks.send.mockClear()
        }
        expect(answers[1]).toEqual(answers[0])
      })

      it('um envio de e-mail lento não atrasa a resposta: conta existente e inexistente no mesmo tempo', async () => {
        const SEND_MS = 1500
        mocks.send.mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ data: { id: 'fixture' }, error: null }),
                SEND_MS
              )
            )
        )
        const timed = async (address: string) => {
          const started = performance.now()
          const response = await forgotPassword(
            post('tenant', '/api/auth/forgot-password', { email: address })
          )
          const elapsed = performance.now() - started
          await flush()
          return {
            status: response.status,
            body: await response.json(),
            elapsed,
          }
        }
        const known = await timed(staffEmail)
        expect(mocks.send).toHaveBeenCalledTimes(1)
        const unknown = await timed(`ninguem-lento-${fixture}@example.test`)
        expect(mocks.send).toHaveBeenCalledTimes(1)
        expect({ status: known.status, body: known.body }).toEqual({
          status: unknown.status,
          body: unknown.body,
        })
        // O envio (1,5 s) ficou fora da resposta nos dois casos.
        expect(known.elapsed).toBeLessThan(SEND_MS)
        expect(Math.abs(known.elapsed - unknown.elapsed)).toBeLessThan(
          SEND_MS / 2
        )
      }, 20_000)

      it('no máximo três links por conta na janela, mesmo vindo de clientes diferentes; a resposta não muda', async () => {
        const statuses: number[] = []
        let sent = 0
        for (let attempt = 0; attempt < 4; attempt++) {
          mocks.send.mockClear()
          const response = await forgotPassword(
            post('tenant', '/api/auth/forgot-password', { email: budgetEmail })
          )
          statuses.push(response.status)
          await flush()
          sent += mocks.send.mock.calls.length
        }
        expect(statuses).toEqual([200, 200, 200, 200])
        expect(sent).toBe(3)
      })
    })

    describe('POST /api/auth/register (better-auth)', () => {
      const neutral = {
        message:
          'Cadastro recebido. Se os dados puderem ser usados, você receberá um email para continuar.',
      }
      const signup = (address: string, cpf: string) =>
        register(
          post('tenant', '/api/auth/register', {
            name: 'Cadastro por rota',
            email: address,
            password,
            phone: '11999990000',
            cpf,
          })
        )

      it('cadastro novo no host da locadora: 202 neutro antes de gravar; verificação na origem da locadora (conta nova, sem vínculo nenhum), com a marca', async () => {
        const response = await signup(signupEmail, `cpf-${fixture}`)
        expect(response.status).toBe(202)
        expect(await response.json()).toEqual(neutral)
        // A resposta saiu antes do hash, da gravação e do envio.
        expect(mocks.pending).toHaveLength(1)
        expect(await prisma.user.count({ where: { email: signupEmail } })).toBe(
          0
        )
        await flush()
        expect(await prisma.user.count({ where: { email: signupEmail } })).toBe(
          1
        )
        const mail = lastMail()
        expect(mail.subject).toBe(
          `Verifique seu email - ${PLATFORM.displayName}`
        )
        const link = linkOf(mail.text)
        // O cliente volta à vitrine em que se cadastrou (o app mandaria '/' para o painel).
        expect(link.origin).toBe(TENANT)
        expect(link.pathname).toBe('/api/auth/verify-email')
        expect(link.searchParams.get('token')).toBeTruthy()
      })

      it('e-mail já cadastrado e CPF de outra conta: a mesma resposta do cadastro novo, sem revelar nada', async () => {
        const error = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined)
        const existing = await signup(
          email.toUpperCase(),
          `cpf-existing-${fixture}`
        )
        await flush()
        // E-mail novo com o CPF de outra pessoa: o motor recusa (users.cpf único), a rota não repassa.
        const documentInUse = await signup(`outro-${signupEmail}`, takenCpf)
        await flush()
        for (const response of [existing, documentInUse]) {
          expect(response.status).toBe(202)
          expect(await response.json()).toEqual(neutral)
        }
        expect(
          await prisma.user.count({ where: { email: `outro-${signupEmail}` } })
        ).toBe(0)
        const logged = JSON.stringify(error.mock.calls)
        for (const secret of [takenCpf, `outro-${signupEmail}`])
          expect(logged).not.toContain(secret)
        error.mockRestore()
      })

      it('senha acima do limite do motor: 400 pela entrada, antes do cadastro', async () => {
        const response = await register(
          post('tenant', '/api/auth/register', {
            name: 'Cadastro por rota',
            email: `longa-${signupEmail}`,
            password: 'x'.repeat(129),
            phone: '11999990000',
            cpf: `cpf-long-${fixture}`,
          })
        )
        expect(response.status).toBe(400)
        expect(mocks.pending).toHaveLength(0)
      })
    })

    describe('achado 106: e-mail de verificação que não sai depois do commit (better-auth)', () => {
      const neutral = {
        message:
          'Cadastro recebido. Se os dados puderem ser usados, você receberá um email para continuar.',
      }
      const signup = (address: string, cpf: string) =>
        register(
          post('tenant', '/api/auth/register', {
            name: 'Cadastro com e-mail que falha',
            email: address,
            password,
            phone: '11999990000',
            cpf,
          })
        )
      const mailsTo = (address: string) =>
        mocks.send.mock.calls
          .map(
            ([message]) =>
              message as { to: string; subject: string; text: string }
          )
          .filter((message) => message.to === address)
      const identityEvents = (spy: { mock: { calls: unknown[][] } }) =>
        spy.mock.calls
          .filter(([tag]) => tag === '[identity]')
          .map(([, fields]) => (fields as { event?: string }).event)

      it('a entrega falha depois do COMMIT: conta criada, resposta neutra e só verification_email_failed no log, sem o endereço', async () => {
        const error = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined)
        // O Resend responde com erro (e a mensagem dele repete o destinatário).
        mocks.send.mockResolvedValueOnce({
          data: null,
          error: {
            name: 'application_error',
            message: `falhou para ${undeliveredEmail}`,
          },
        })
        const response = await signup(
          undeliveredEmail,
          `cpf-undelivered-${fixture}`
        )
        expect(response.status).toBe(202)
        expect(await response.json()).toEqual(neutral)
        await flush()
        expect(
          await prisma.user.count({
            where: { email: undeliveredEmail, authEmailVerified: false },
          })
        ).toBe(1)
        expect(mailsTo(undeliveredEmail)).toHaveLength(1)
        // Não é falha de cadastro: a conta nasceu; a entrega é que não saiu.
        expect(identityEvents(error)).toEqual(['verification_email_failed'])
        expect(JSON.stringify(error.mock.calls)).not.toContain(undeliveredEmail)
        error.mockRestore()
      })

      it('reenvio: repetir o cadastro da conta sem verificar manda um novo link (no máximo 1 a cada 5 min) que verifica a conta; conta verificada não recebe nada', async () => {
        const error = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined)
        expect(
          (await signup(resendEmail, `cpf-resend-${fixture}`)).status
        ).toBe(202)
        await flush()
        expect(mailsTo(resendEmail)).toHaveLength(1)
        // O cadastro repetido (outro CPF, outra senha) não muda a conta: só reenvia a verificação.
        const again = await signup(resendEmail, `cpf-resend-again-${fixture}`)
        expect(again.status).toBe(202)
        expect(await again.json()).toEqual(neutral)
        await flush()
        const resent = mailsTo(resendEmail)
        expect(resent).toHaveLength(2)
        expect(resent[1]!.subject).toBe(
          `Verifique seu email - ${PLATFORM.displayName}`
        )
        const link = linkOf(resent[1]!.text)
        expect(link.origin).toBe(TENANT)
        expect(link.pathname).toBe('/api/auth/verify-email')
        // Na mesma janela de 5 min: a mesma resposta, sem outro e-mail.
        const third = await signup(resendEmail, `cpf-resend-third-${fixture}`)
        expect(third.status).toBe(202)
        expect(await third.json()).toEqual(neutral)
        await flush()
        expect(mailsTo(resendEmail)).toHaveLength(2)
        // Conta já verificada: repetir o cadastro não manda verificação.
        expect((await signup(email, `cpf-verified-${fixture}`)).status).toBe(
          202
        )
        await flush()
        expect(mailsTo(email)).toEqual([])
        expect(identityEvents(error)).toEqual([])
        error.mockRestore()
        // O link reenviado confirma o e-mail no host em que o cadastro foi feito.
        const verified = await handleIdentityRequest(
          new Request(`${BACKEND}${link.pathname}${link.search}`, {
            headers: {
              [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
              [PLATFORM_EDGE_HEADER.hostKind]: 'tenant',
              [PLATFORM_EDGE_HEADER.origin]: TENANT,
              [PLATFORM_EDGE_HEADER.tenantSlug]: slug,
            },
          })
        )
        expect(verified.status).toBe(302)
        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { email: resendEmail },
            })
          ).authEmailVerified
        ).toBe(true)
        expect(
          await prisma.user.count({
            where: { cpf: `cpf-resend-again-${fixture}` },
          })
        ).toBe(0)
      })
    })
  }
)

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = (await import('@/lib/prisma')) as unknown as {
    prisma: { $disconnect(): Promise<void> }
    testPool: { end(): Promise<void> }
  }
  await database.prisma.$disconnect()
  await database.testPool.end()
})
