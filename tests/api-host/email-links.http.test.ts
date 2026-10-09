import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import type {} from './global-setup'
import { parityTargets } from './targets'
import { emailLinks, emailsTo, type CapturedEmail } from './resend-provider'

/**
 * Onda 135, B9: os e-mails de conta que os hosts mandam de verdade (pelo SDK do Resend, apontado ao dublê de loopback
 * do global-setup) e os links que eles levam, nos dois motores. Cada link aponta para a origem pública configurada
 * (NextAuth: `NEXTAUTH_URL`; Better Auth: a origem do `app` pela borda), nunca para o host que recebeu o pedido, e
 * funciona quando seguido: a verificação marca a conta e o reset troca a senha uma vez só.
 *
 * Os e-mails do motor legado saem só em produção (`NODE_ENV=production`, `credential-accounts.ts`): o perfil da CI
 * (`API_HOST_MODE=production`, com ou sem a raiz) é o que este arquivo prova.
 */
const context = inject('apiParity')
const mode = context.identity.mode
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const marker = `email-links-${randomUUID()}`
const appOrigin = 'https://app.platform.test'
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': appOrigin,
}
const password = 'email-links-fixture-password'
const replacement = 'email-links-replacement-password'
const created: string[] = []
let requests = 0

function address(label: string) {
  const email = `${marker}-${label}@example.test`
  created.push(email)
  return email
}

async function post(host: string, flow: string, body: unknown) {
  const response = await fetch(`${host}/api/auth/${flow}`, {
    method: 'POST',
    headers: {
      ...edge,
      // Endereços reservados desta rodada; o orçamento real de cada IP continua valendo.
      'x-platform-client-ip': context.directory.ips[50 + (requests++ % 10)]!,
      Origin: appOrigin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
  return { status: response.status, body: await response.json() }
}

/** O único e-mail que chegou ao dublê para `to`, esperando o envio feito depois da resposta HTTP. */
async function onlyEmailTo(to: string): Promise<CapturedEmail> {
  await expect
    .poll(async () => (await emailsTo(context.resendOrigin, to)).length, {
      timeout: 15_000,
    })
    .toBe(1)
  // Nenhum segundo envio chega depois do primeiro.
  await new Promise((resolve) => setTimeout(resolve, 500))
  const emails = await emailsTo(context.resendOrigin, to)
  expect(emails).toHaveLength(1)
  return emails[0]!
}

/** O link da conta no e-mail: um só, na origem pública e no caminho esperado. */
function accountLink(email: CapturedEmail, origin: string, pathname: string) {
  const links = emailLinks(email)
    .map((link) => new URL(link))
    .filter((link) => link.pathname === pathname)
  expect(links.map((link) => link.origin)).toEqual([origin])
  return links[0]!
}

/** Segue o link contra o host da rodada, com a borda do `app` (como o proxy do host web entrega). */
function follow(host: string, link: URL) {
  return fetch(`${host}${link.pathname}${link.search}`, {
    headers: edge,
    redirect: 'manual',
  })
}

beforeAll(async () => {
  expect(context.resendOrigin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
})

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: created } },
    select: { id: true },
  })
  const ids = users.map((user) => user.id)
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: {
        in: created.flatMap((email) => [
          `email-verification:${email}`,
          `password-reset:${email}`,
        ]),
      },
    },
  })
  await prisma.authVerification.deleteMany({ where: { value: { in: ids } } })
  await prisma.authSession.deleteMany({ where: { userId: { in: ids } } })
  await prisma.authAccount.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
  await pool.end()
})

for (const host of parityTargets(context)) {
  const name = host === context.legacy ? 'legacy root' : 'shared API'
  const label = host === context.legacy ? 'legacy' : 'api'

  describe(`account e-mail links sent by the ${name} (${mode})`, () => {
    it('registration sends one verification e-mail whose link verifies the account', async () => {
      const email = address(`register-${label}`)
      expect(
        await post(host, 'register', {
          email,
          name: marker,
          password,
          phone: '11999990000',
          cpf: `${marker}-${label}`,
        })
      ).toMatchObject({ status: 202 })
      const message = await onlyEmailTo(email)
      expect(message.from).toBe(context.mailFrom)
      const link =
        mode === 'legacy'
          ? // NextAuth: a URL configurada (no harness, a API que serve o NextAuth), mesmo vindo pela raiz.
            accountLink(message, context.api, '/api/auth/verify-email')
          : // Better Auth: a origem pública do app que a borda validou, nunca a do processo.
            accountLink(message, appOrigin, '/api/auth/verify-email')
      expect(link.searchParams.get('token')).toBeTruthy()
      const before = await prisma.user.findUniqueOrThrow({ where: { email } })
      expect(before.authEmailVerified).toBe(false)
      const answer = await follow(host, link)
      expect([302, 307]).toContain(answer.status)
      expect(answer.headers.get('location')).not.toMatch(/error/)
      const after = await prisma.user.findUniqueOrThrow({ where: { email } })
      expect(after.authEmailVerified).toBe(true)
      // O link é de uso único: seguido de novo, não verifica nada outra vez nem devolve sucesso.
      const again = await follow(host, link)
      expect(again.headers.get('location') ?? '').not.toMatch(/verified=true/)
    })

    it('password recovery sends one reset e-mail whose token changes the password once', async () => {
      const email = address(`reset-${label}`)
      const hash = await bcrypt.hash(password, 12)
      const user = await prisma.user.create({
        data: { email, name: marker, password: hash, authEmailVerified: true },
      })
      if (mode === 'better-auth')
        await prisma.authAccount.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: 'credential',
            password: hash,
          },
        })
      expect(await post(host, 'forgot-password', { email })).toMatchObject({
        status: 200,
      })
      const message = await onlyEmailTo(email)
      expect(message.from).toBe(context.mailFrom)
      const link = accountLink(
        message,
        mode === 'legacy' ? context.api : appOrigin,
        '/reset-password'
      )
      const token = link.searchParams.get('token')
      expect(token).toBeTruthy()
      expect(
        await post(host, 'reset-password', { token, password: replacement })
      ).toMatchObject({ status: 200 })
      const stored =
        mode === 'legacy'
          ? (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
              .password
          : (
              await prisma.authAccount.findFirstOrThrow({
                where: { userId: user.id, providerId: 'credential' },
              })
            ).password
      expect(await bcrypt.compare(replacement, stored!)).toBe(true)
      // O mesmo token não troca a senha de novo.
      const reused = await post(host, 'reset-password', {
        token,
        password: 'email-links-third-password',
      })
      expect(reused.status).toBe(400)
    })
  })
}
