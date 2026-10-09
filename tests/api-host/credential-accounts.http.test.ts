import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import type {} from './global-setup'
import { otherTarget, parityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const marker = `credential-${randomUUID()}`
const emails = [0, 1, 2, 3, 4, 5].map(
  (index) => `${marker}-${index}@example.test`
)
const password = 'credential-fixture-password'
const replacement = 'credential-replacement-password'
const neutralRegistration = {
  message:
    'Cadastro recebido. Se os dados puderem ser usados, você receberá um email para continuar.',
}
const neutralRecovery = {
  message: 'Se o email existir, você receberá instruções de recuperação.',
}
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex')
// Next normalizes the loopback request URL to localhost in both hosts.
const requestOrigin = (host: string) => host.replace('127.0.0.1', 'localhost')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
}
let requests = 0
async function post(
  host: string,
  flow: string,
  body: unknown,
  origin = edge['x-platform-origin']
) {
  const response = await fetch(`${host}/api/auth/${flow}`, {
    method: 'POST',
    headers: {
      ...edge,
      // Distinct fixture clients; do not clear or widen production budgets.
      'x-platform-client-ip': context.directory.ips[requests++ % 60]!,
      Origin: origin,
      'Content-Type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    redirect: 'manual',
  })
  return { status: response.status, body: await response.json() }
}
async function verify(host: string, token?: string) {
  const response = await fetch(
    `${host}/api/auth/verify-email${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    { headers: edge, redirect: 'manual' }
  )
  return { status: response.status, location: response.headers.get('location') }
}
async function sqlFailure(
  table: 'users' | 'verificationtokens',
  operation: 'INSERT' | 'UPDATE',
  field: 'email' | 'identifier',
  value: string,
  task: () => Promise<void>
) {
  // The connection is validated by requireTestDatabase, and the identifier and
  // comparison value are generated fixtures, never request input.
  if (!/^[a-z0-9@.:-]+$/.test(value)) throw new Error('Invalid fixture value')
  const name = 'wave56_' + randomUUID().replaceAll('-', '')
  await pool.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.${field} = '${value}' THEN RAISE EXCEPTION 'wave56_fixture_failure'; END IF; RETURN NEW; END $$`
  )
  try {
    await pool.query(
      `CREATE TRIGGER ${name} BEFORE ${operation} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`
    )
    try {
      await task()
    } finally {
      await pool.query(`DROP TRIGGER ${name} ON ${table}`)
    }
  } finally {
    await pool.query(`DROP FUNCTION ${name}()`)
  }
}
beforeAll(async () => {
  const hash = await bcrypt.hash(password, 12)
  for (const email of emails.slice(2, 4)) {
    const user = await prisma.user.create({
      data: { email, name: marker, password: hash, authEmailVerified: true },
    })
    if (context.identity.mode === 'better-auth')
      await prisma.authAccount.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: hash,
        },
      })
  }
})
afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  })
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: {
        in: emails.flatMap((email) => [
          `email-verification:${email}`,
          `password-reset:${email}`,
        ]),
      },
    },
  })
  await prisma.authVerification.deleteMany({
    where: { value: { in: users.map((user) => user.id) } },
  })
  await prisma.user.deleteMany({ where: { email: { in: emails } } })
  await prisma.$disconnect()
  await pool.end()
})

for (const [index, host] of parityTargets(context).entries()) {
  // O consumo único é provado com uma segunda chamada real: no outro host enquanto os dois coexistem e na própria API
  // sem a raiz (onda 135, E1).
  const other = otherTarget(context, host)
  describe(`credential flows in ${host === context.legacy ? 'legacy' : 'shared API'} (${context.identity.mode})`, () => {
    for (const flow of ['register', 'forgot-password', 'reset-password'])
      it(`${flow}: rejects a sibling origin before parsing or writing`, async () => {
        const before = await prisma.user.count({
          where: { email: { in: emails } },
        })
        expect(
          await post(host, flow, '{', 'https://bravo.platform.test')
        ).toEqual({
          status: 403,
          body: { error: 'Origem não permitida' },
        })
        expect(
          await prisma.user.count({ where: { email: { in: emails } } })
        ).toBe(before)
      })

    it('validates registration before applying the account flow', async () => {
      const result = await post(host, 'register', { email: 'invalid' })
      expect(result.status).toBe(400)
      expect(await prisma.user.count({ where: { email: emails[index] } })).toBe(
        0
      )
    })
    it('creates one global account without enrolling it into any tenant, with the neutral response', async () => {
      const body = {
        email: `  ${emails[index]!.toUpperCase()}  `,
        name: marker,
        password,
        phone: '11999990000',
        cpf: `${marker}-${index}`,
      }
      expect(await post(host, 'register', body)).toEqual({
        status: 202,
        body: neutralRegistration,
      })
      // Better Auth creation is deferred until after the HTTP response.
      await expect
        .poll(() => prisma.user.count({ where: { email: emails[index] } }))
        .toBe(1)
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: emails[index] },
      })
      expect(
        await prisma.membership.count({ where: { userId: user.id } })
      ).toBe(0)
      expect(
        await prisma.clientProfile.count({ where: { userId: user.id } })
      ).toBe(0)
      if (context.identity.mode === 'legacy') {
        expect(await bcrypt.compare(password, user.password!)).toBe(true)
        const token = await prisma.verificationToken.findFirstOrThrow({
          where: { identifier: `email-verification:${user.email}` },
        })
        expect(token.token).toMatch(/^[0-9a-f-]{36}$/)
        expect(token.expires.getTime() - Date.now()).toBeGreaterThan(
          23 * 60 * 60 * 1000
        )
      } else {
        const account = await prisma.authAccount.findFirstOrThrow({
          where: { userId: user.id, providerId: 'credential' },
        })
        expect(await bcrypt.compare(password, account.password!)).toBe(true)
      }
      expect(await post(host, 'register', body)).toEqual({
        status: 202,
        body: neutralRegistration,
      })
      expect(await prisma.user.count({ where: { email: user.email } })).toBe(1)
    })
    it('returns the same recovery answer for a known and unknown account', async () => {
      for (const email of [
        emails[index + 2],
        `${marker}-unknown-${index}@example.test`,
      ])
        expect(await post(host, 'forgot-password', { email })).toEqual({
          status: 200,
          body: neutralRecovery,
        })
      if (context.identity.mode === 'legacy') {
        await expect
          .poll(() =>
            prisma.verificationToken.count({
              where: { identifier: `password-reset:${emails[index + 2]}` },
            })
          )
          .toBe(1)
        const token = await prisma.verificationToken.findFirstOrThrow({
          where: { identifier: `password-reset:${emails[index + 2]}` },
        })
        expect(token.token).toMatch(/^[a-f0-9]{64}$/)
        expect(token.expires.getTime() - Date.now()).toBeGreaterThan(
          55 * 60 * 1000
        )
      }
    })
    it('refuses an invalid reset token through the active real identity engine', async () => {
      const answer = await post(host, 'reset-password', {
        token: marker,
        password: replacement,
      })
      expect(answer.status).toBe(400)
      expect(answer.body).toEqual(
        context.identity.mode === 'legacy'
          ? { error: 'Token inválido ou expirado' }
          : { code: 'INVALID_TOKEN', message: 'Invalid token' }
      )
    })
    if (context.identity.mode === 'better-auth')
      it('lets the real engine consume a recovery token once and revoke existing sessions', async () => {
        const user = await prisma.user.findUniqueOrThrow({
          where: { email: emails[index + 2] },
        })
        const raw = randomUUID()
        await prisma.authVerification.create({
          data: {
            identifier: `reset-password:${raw}`,
            value: user.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
        })
        await prisma.authSession.create({
          data: {
            token: randomUUID(),
            userId: user.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
        })
        expect(
          await post(host, 'reset-password', {
            token: raw,
            password: replacement,
          })
        ).toEqual({
          status: 200,
          body: { message: 'Senha redefinida com sucesso' },
        })
        expect(
          await prisma.authVerification.count({
            where: { identifier: `reset-password:${raw}` },
          })
        ).toBe(0)
        expect(
          await prisma.authSession.count({ where: { userId: user.id } })
        ).toBe(0)
        const account = await prisma.authAccount.findFirstOrThrow({
          where: { userId: user.id, providerId: 'credential' },
        })
        expect(await bcrypt.compare(replacement, account.password!)).toBe(true)
        expect(
          await post(other, 'reset-password', { token: raw, password })
        ).toEqual({
          status: 400,
          body: { code: 'INVALID_TOKEN', message: 'Invalid token' },
        })
      })
    if (context.identity.mode === 'legacy') {
      it('rolls back account creation when verification-token persistence fails', async () => {
        const email = emails[index + 4]!
        await sqlFailure(
          'verificationtokens',
          'INSERT',
          'identifier',
          `email-verification:${email}`,
          async () => {
            expect(
              await post(host, 'register', {
                name: marker,
                email,
                password,
                phone: '11999990000',
                cpf: `${marker}-rollback-${index}`,
              })
            ).toEqual({
              status: 500,
              body: { error: 'Erro interno do servidor' },
            })
            expect(await prisma.user.count({ where: { email } })).toBe(0)
            expect(
              await prisma.verificationToken.count({
                where: { identifier: `email-verification:${email}` },
              })
            ).toBe(0)
          }
        )
      })
      it('consumes the verification token once across both HTTP hosts', async () => {
        const user = await prisma.user.findUniqueOrThrow({
          where: { email: emails[index] },
        })
        const token = await prisma.verificationToken.findFirstOrThrow({
          where: { identifier: `email-verification:${user.email}` },
        })
        expect(await verify(host, token.token)).toEqual({
          status: 307,
          location: `${requestOrigin(host)}/login?verified=true`,
        })
        expect(await verify(other, token.token)).toEqual({
          status: 307,
          location: `${requestOrigin(other)}/login?error=token-expired`,
        })
        const verified = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        })
        expect(verified.emailVerified).toBeInstanceOf(Date)
        expect(verified.authEmailVerified).toBe(true)
      })
      it('atomically changes the password and consumes all reset links and v2 sessions', async () => {
        const email = emails[index + 2]!
        const user = await prisma.user.findUniqueOrThrow({ where: { email } })
        const raw = randomUUID()
        await prisma.verificationToken.create({
          data: {
            identifier: `password-reset:${email}`,
            token: tokenHash(raw),
            expires: new Date(Date.now() + 60_000),
          },
        })
        await prisma.authSession.create({
          data: {
            token: randomUUID(),
            userId: user.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
        })
        await sqlFailure('users', 'UPDATE', 'email', email, async () => {
          expect(
            await post(host, 'reset-password', {
              token: raw,
              password: replacement,
            })
          ).toEqual({
            status: 500,
            body: { error: 'Erro interno do servidor' },
          })
          expect(
            await prisma.verificationToken.count({
              where: { token: tokenHash(raw) },
            })
          ).toBe(1)
          expect(
            await prisma.authSession.count({ where: { userId: user.id } })
          ).toBe(1)
          const unchanged = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
          })
          expect(unchanged.password).toBe(user.password)
        })
        expect(
          await post(host, 'reset-password', {
            token: raw,
            password: replacement,
          })
        ).toEqual({
          status: 200,
          body: { message: 'Senha redefinida com sucesso' },
        })
        expect(
          await prisma.verificationToken.count({
            where: { identifier: `password-reset:${email}` },
          })
        ).toBe(0)
        expect(
          await prisma.authSession.count({ where: { userId: user.id } })
        ).toBe(0)
        const changed = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        })
        expect(await bcrypt.compare(replacement, changed.password!)).toBe(true)
        expect(
          await post(other, 'reset-password', { token: raw, password })
        ).toEqual({
          status: 400,
          body: { error: 'Token inválido ou expirado' },
        })
      })
      it('retains missing-token redirect semantics', async () => {
        expect(await verify(host)).toEqual({
          status: 307,
          location: `${requestOrigin(host)}/login?error=token-missing`,
        })
      })
    }
  })
}
