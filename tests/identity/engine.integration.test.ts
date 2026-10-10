import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createIdentity } from '../../packages/backend/src/modules/identity/factory'
import { identityConfiguration } from '../../packages/backend/src/modules/identity/configuration'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { prismaRateLimitCounter } from '@gb-locacoes/backend/directory'
import {
  createIdentityLimiters,
  clientIpFromHeaders,
} from '@gb-locacoes/backend/identity'
import { identityRateLimitSecret } from '@gb-locacoes/backend/directory'
const { legacySignInGuard } = createIdentityLimiters({
  loadCounter: async () => prismaRateLimitCounter(prisma),
  secret: identityRateLimitSecret,
  clientIp: clientIpFromHeaders,
})

import { requireTestDatabase } from '../helpers/test-database'
if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
  throw new Error('Disposable database opt-in required')
const connection = requireTestDatabase(process.env)
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connection }),
})
const fixture = randomUUID()
const email = `identity-${fixture}@example.test`
const signupEmail = `signup-${fixture}@example.test`
const password = 'legacy-fixture-password'
const ip = `2001:db8:${fixture.slice(0, 4)}:${fixture.slice(4, 8)}::1`
const mail = {
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
}
const config = identityConfiguration({
  AUTH_MODE: 'better-auth',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'fixture-only-identity-secret-more-than-thirty-two',
  AUTH_TRUSTED_ORIGINS: 'acme://',
  GOOGLE_CLIENT_ID: 'fixture-google',
  GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
})
const auth = createIdentity(prisma, config, mail)
let userId: string
function req(
  path: string,
  body?: unknown,
  cookie?: string,
  origin = 'http://localhost:3000'
) {
  return new Request(`${config.baseURL}${config.basePath}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
async function signIn() {
  const response = await auth.handler(
    req('/sign-in/email', { email, password })
  )
  expect(response.status).toBe(200)
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
}
beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('External network forbidden in identity tests')
    })
  )
  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Identity fixture',
      role: 'ADMIN',
      password: hash,
      authEmailVerified: true,
    },
  })
  userId = user.id
  await prisma.authAccount.create({
    data: {
      userId,
      accountId: userId,
      providerId: 'credential',
      password: hash,
    },
  })
})
afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [email, signupEmail, `closed-${signupEmail}`] } },
  })
  await prisma.authRateLimit.deleteMany({ where: { key: { contains: ip } } })
  await prisma.$disconnect()
  vi.unstubAllGlobals()
})

describe('BetterAuth HTTP engine with the Prisma adapter', () => {
  it('accepts an imported bcrypt hash and returns a persisted session cookie', async () => {
    const cookie = await signIn()
    // Sem https (desenvolvimento), o cookie leva o nome da plataforma sem o prefixo __Host-.
    expect(cookie).toContain(`${PLATFORM.name}.session_token=`)
    expect(cookie).not.toContain('better-auth.')
    const response = await auth.handler(req('/get-session', undefined, cookie))
    expect(response.status).toBe(200)
    const session = await response.json()
    expect(session.user.id).toBe(userId)
    expect(session.user.role).toBe('ADMIN')
    expect(
      await prisma.authSession.count({ where: { userId } })
    ).toBeGreaterThan(0)
  })
  it('rejects the wrong password', async () => {
    const response = await auth.handler(
      req('/sign-in/email', { email, password: 'wrong-password' })
    )
    expect(response.status).toBe(401)
  })
  it('rejects a foreign web origin', async () => {
    const response = await auth.handler(
      req(
        '/sign-in/email',
        { email, password },
        undefined,
        'https://attacker.example.test'
      )
    )
    expect(response.status).toBe(403)
  })
  it('a revoked database session cannot be restored from its cookie', async () => {
    const cookie = await signIn()
    await prisma.authSession.deleteMany({ where: { userId } })
    const response = await auth.handler(req('/get-session', undefined, cookie))
    expect(await response.json()).toBeNull()
  })
  it('does not accept a privileged role from signup input', async () => {
    // Called the way /api/auth/register does: signup is closed over HTTP (see below).
    const request = req('/sign-up/email')
    const response = await auth.api.signUpEmail({
      body: {
        email: signupEmail,
        name: 'Signup fixture',
        password,
        phone: '11999990000',
        cpf: fixture,
        role: 'ADMIN',
      } as Parameters<typeof auth.api.signUpEmail>[0]['body'],
      headers: request.headers,
      request,
      asResponse: true,
    })
    expect(response.status).toBe(200)
    const user = await prisma.user.findUnique({ where: { email: signupEmail } })
    expect(user?.role).toBe('CLIENT')
    expect(user?.password).toBeNull()
    expect(mail.sendEmailVerification).toHaveBeenCalledOnce()
  })
  it('password recovery revokes sessions and does not write the legacy password column', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    })
    const cookie = await signIn()
    // Called the way /api/auth/forgot-password does (closed over HTTP).
    const request = req('/request-password-reset')
    expect(
      (
        await auth.api.requestPasswordReset({
          body: {
            email,
            redirectTo: 'http://localhost:3000/reset-password',
          },
          headers: request.headers,
          request,
          asResponse: true,
        })
      ).status
    ).toBe(200)
    // O link leva à página de redefinição do host de origem (sem borda: o app).
    const resetUrl = new URL(mail.sendPasswordReset.mock.calls.at(-1)?.[0].url)
    expect(`${resetUrl.origin}${resetUrl.pathname}`).toBe(
      `${config.baseURL}/reset-password`
    )
    const token = resetUrl.searchParams.get('token')
    const response = await auth.handler(
      req('/reset-password', {
        token,
        newPassword: 'replacement-fixture-password',
      })
    )
    expect(response.status).toBe(200)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
    expect(
      await (await auth.handler(req('/get-session', undefined, cookie))).json()
    ).toBeNull()
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    })
    expect(after.password).toBe(before.password)
    expect(
      (
        await auth.handler(
          req('/reset-password', { token, newPassword: password })
        )
      ).status
    ).toBe(400)
  })
  it('anonymous e-mail endpoints answer 404 over HTTP in both base paths (only the own routes reach them)', async () => {
    mail.sendEmailVerification.mockClear()
    mail.sendPasswordReset.mockClear()
    const coexistence = createIdentity(
      prisma,
      { ...config, mode: 'legacy', basePath: '/api/auth/v2' },
      mail,
      legacySignInGuard({ counter: prismaRateLimitCounter(prisma) })
    )
    for (const [engine, basePath] of [
      [auth, config.basePath],
      [coexistence, '/api/auth/v2'],
    ] as const)
      for (const [path, body] of [
        [
          '/sign-up/email',
          {
            email: `closed-${signupEmail}`,
            name: 'Closed',
            password,
            phone: '11999990000',
            cpf: `closed-${fixture}`,
          },
        ],
        ['/request-password-reset', { email }],
        ['/send-verification-email', { email }],
      ] as const) {
        const response = await engine.handler(
          new Request(`${config.baseURL}${basePath}${path}`, {
            method: 'POST',
            headers: {
              origin: config.baseURL,
              'content-type': 'application/json',
              'x-forwarded-for': ip,
            },
            body: JSON.stringify(body),
          })
        )
        expect(response.status).toBe(404)
      }
    expect(
      await prisma.user.count({ where: { email: `closed-${signupEmail}` } })
    ).toBe(0)
    expect(mail.sendEmailVerification).not.toHaveBeenCalled()
    expect(mail.sendPasswordReset).not.toHaveBeenCalled()
  })
  it('coexistence rejects a second password writer', async () => {
    const preview = createIdentity(
      prisma,
      { ...config, mode: 'legacy', basePath: '/api/auth/v2' },
      mail,
      // Coexistence requires the legacy sign-in guard (same windows as NextAuth).
      legacySignInGuard({ counter: prismaRateLimitCounter(prisma) })
    )
    const response = await preview.handler(
      new Request('http://localhost:3000/api/auth/v2/reset-password', {
        method: 'POST',
        headers: { origin: config.baseURL, 'content-type': 'application/json' },
        body: JSON.stringify({
          token: 'fixture',
          newPassword: 'replacement-fixture-password',
        }),
      })
    )
    expect(response.status).toBe(403)
  })
})
