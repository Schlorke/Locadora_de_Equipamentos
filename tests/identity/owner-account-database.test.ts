import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
import { createIdentity } from '../../packages/backend/src/modules/identity/factory'
import { identityConfiguration } from '../../packages/backend/src/modules/identity/configuration'
import { createCredentialAccounts } from '../../packages/backend/src/modules/identity/credential-accounts'
import { createOwnerAccountRuntime } from '../../packages/backend/src/runtime/owner-account'
import { createIdentityLimiters } from '../../packages/backend/src/modules/identity/rate-limit'
import { prismaRateLimitCounter } from '../../packages/backend/src/modules/directory/index'

const pool = new Pool({
  connectionString: requireTestDatabase(process.env),
  max: 4,
})
const database = new PrismaClient({ adapter: new PrismaPg(pool) })
const marker = 'owner-account-' + randomUUID()
const input = {
  name: 'Synthetic Owner',
  email: marker + '@example.test',
  password: 'synthetic-owner-password',
}
const oldInput = {
  name: 'Customer Control',
  email: marker + '-customer@example.test',
  password: input.password,
  phone: '11999999999',
  cpf: '52998224725',
}
const mail = {
  sendPasswordReset: vi.fn(),
  sendEmailVerification: vi.fn(),
  verificationResendAllowed: vi.fn().mockResolvedValue(true),
}
const config = identityConfiguration({
  AUTH_MODE: 'better-auth',
  BETTER_AUTH_URL: 'http://app.localhost:34119',
  BETTER_AUTH_SECRET: 'synthetic-owner-identity-secret-more-than32',
  PLATFORM_ENV: 'development',
  PLATFORM_ROOT_DOMAIN: 'localhost',
  PLATFORM_PUBLIC_PORT: '34119',
})
const identity = createIdentity(database, config, mail)
const pending: Array<() => Promise<void>> = []
const accounts = createCredentialAccounts({
  database: () => database,
  getIdentity: async () => identity,
  findAccountsByEmail: async () => [],
  resend: null,
  after: (task) => {
    pending.push(task)
  },
  consumeAccountNotice: async () => true,
  resetAuthAccountAttempts: async () => {},
})
const env = {
  PLATFORM_ENV: 'development',
  PLATFORM_ROOT_DOMAIN: 'localhost',
  PLATFORM_PUBLIC_PORT: '34119',
  PLATFORM_SELF_SERVICE_SIGNUP: 'on',
  AUTH_MODE: 'better-auth',
  PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
  PLATFORM_SECRETS_KMS_KEY_ARN: 'synthetic-key',
  AWS_ROLE_ARN: 'synthetic-role',
  AWS_WEB_IDENTITY_TOKEN_FILE: 'synthetic-file',
  PLATFORM_CAPTCHA_SECRET_KEY: 'synthetic-secret',
  PLATFORM_CAPTCHA_SITE_KEY: 'synthetic-site',
}
const limits = createIdentityLimiters({
  loadCounter: async () => prismaRateLimitCounter(database),
  secret: () => 'synthetic-owner-rate-secret-more-than32',
  clientIp: () => '192.0.2.118',
})
const runtime = createOwnerAccountRuntime({
  database: () => database,
  accounts,
  refuseAuthAttempt: limits.refuseAuthAttempt,
  consumeAccountNotice: limits.consumeAccountNotice,
  environment: () => env,
})
const request = () =>
  new Request('http://app.localhost:34119/api/auth/owner-register', {
    method: 'POST',
    headers: { Origin: config.baseURL, 'Content-Type': 'application/json' },
  })
beforeAll(() => {
  vi.stubEnv('AUTH_MODE', 'better-auth')
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await database.user.deleteMany({
    where: {
      email: {
        in: [input.email, oldInput.email, marker + '-no-context@example.test'],
      },
    },
  })
  await database.$disconnect()
  await pool.end()
})
it('creates a minimum unverified account with the real engine after the response task, no company or membership', async () => {
  await accounts.registerOwnerAccount(input, request())
  expect(
    await database.user.findUnique({ where: { email: input.email } })
  ).toBeNull()
  await pending.shift()!()
  const user = await database.user.findUniqueOrThrow({
    where: { email: input.email },
  })
  expect(user.authEmailVerified).toBe(false)
  expect(user.phone).toBeNull()
  expect(user.cpf).toBeNull()
  expect(user.cnpj).toBeNull()
  expect(await database.membership.count({ where: { userId: user.id } })).toBe(
    0
  )
  expect(
    await database.organization.count({ where: { ownerUserId: user.id } })
  ).toBe(0)
  expect(
    await database.authAccount.count({
      where: { userId: user.id, providerId: 'credential' },
    })
  ).toBe(1)
  expect(mail.sendEmailVerification).toHaveBeenCalledTimes(1)
}, 30_000)
it('does not accept minimum data through an ordinary sign-up call or a forged body flag', async () => {
  await expect(
    identity.api.signUpEmail({
      body: {
        ...input,
        email: marker + '-no-context@example.test',
        owner: true,
      } as typeof input,
      headers: request().headers,
      request: request(),
      asResponse: true,
    })
  ).rejects.toMatchObject({ message: 'Phone and CPF or CNPJ are required' })
  expect(
    await database.user.count({
      where: { email: marker + '-no-context@example.test' },
    })
  ).toBe(0)
}, 30_000)
it('preserves the existing customer phone/document requirement and registration', async () => {
  await accounts.registerAccount(oldInput, request())
  await pending.shift()!()
  expect(
    await database.user.findUniqueOrThrow({ where: { email: oldInput.email } })
  ).toMatchObject({
    phone: oldInput.phone,
    cpf: oldInput.cpf,
    authEmailVerified: false,
  })
}, 30_000)
it('resends and consumes a real verification token, then reads the fact from the current account row', async () => {
  const user = await database.user.findUniqueOrThrow({
    where: { email: input.email },
  })
  const req = new Request(config.baseURL + '/api/auth/owner-account')
  // Isolate the configured-publication prerequisite; GET below still uses the real runtime reader.
  const read = (
    await import('../../packages/backend/src/http/owner-account')
  ).createOwnerAccountHandlers({
    environment: () => env,
    checkSignup: async () => {},
    refuseAttempt: async () => null,
    verifyRegistration: async () => {},
    register: async () => {},
    read: (id) =>
      database.user.findUnique({
        where: { id },
        select: { id: true, email: true, authEmailVerified: true },
      }),
    consumeResend: async () => false,
    resend: async () => {},
  })
  expect(await (await read.read(req, user.id)).json()).toEqual({
    userId: user.id,
    emailVerified: false,
  })
  mail.sendEmailVerification.mockClear()
  await accounts.resendOwnerVerification(input.email, request())
  expect(mail.sendEmailVerification).not.toHaveBeenCalled()
  await pending.shift()!()
  expect(mail.sendEmailVerification).toHaveBeenCalledTimes(1)
  const sent = mail.sendEmailVerification.mock.calls[0]![0] as {
    email: string
    url: string
  }
  expect(sent.email).toBe(input.email)
  const link = new URL(sent.url)
  expect(link.origin).toBe(config.baseURL)
  expect(
    new URL(link.searchParams.get('callbackURL')!, config.baseURL).pathname
  ).toBe('/comecar')
  const token = link.searchParams.get('token')
  expect(token).toBeTruthy()
  const verified = await identity.api.verifyEmail({
    query: { token: token! },
    headers: request().headers,
    request: request(),
    asResponse: true,
  })
  expect(verified.ok).toBe(true)
  expect(await (await read.read(req, user.id)).json()).toEqual({
    userId: user.id,
    emailVerified: true,
  })
}, 30_000)
it('uses a persistent per-minute budget shared by separate compositions and the common daily limit', async () => {
  const other = createIdentityLimiters({
    loadCounter: async () => prismaRateLimitCounter(database),
    secret: () => 'synthetic-owner-rate-secret-more-than32',
    clientIp: () => '192.0.2.118',
  })
  const now = Date.UTC(2040, 0, 1, 12)
  const take = (at: number) =>
    limits.consumeAccountNotice('owner-verification-resend', input.email, {
      now: at,
    })
  expect(await take(now)).toBe(true)
  expect(
    await other.consumeAccountNotice('owner-verification-resend', input.email, {
      now: now + 30_000,
    })
  ).toBe(false)
  expect(await take(now + 60_000)).toBe(true)
  for (let attempt = 0; attempt < 3; attempt++)
    expect(
      await limits.consumeAccountNotice(
        'verification-resend-day',
        input.email,
        { now }
      )
    ).toBe(true)
  expect(
    await other.consumeAccountNotice('verification-resend-day', input.email, {
      now,
    })
  ).toBe(false)
  // Runtime is composed without opening a new engine/pool; no provider request runs here.
  expect(typeof runtime.resend).toBe('function')
}, 30_000)
