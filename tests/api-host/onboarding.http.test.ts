import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  onboardingInput,
  onboardingPublication,
} from '../helpers/onboarding-data'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { sessionCookies, signInParityUser } from './identity'
import { startReceivingAccountFixture } from './receiving-account'
import { emailLinks, emailsTo, startResendFixture } from './resend-provider'
import { parityTargets } from './targets'

/**
 * Onda 135, B10 (E30): o cadastro de locadora pela API compartilhada em HTTP real, sem importar handlers.
 * - Cadastro desligado (`PLATFORM_SELF_SERVICE_SIGNUP=off`, o padrão de hoje), nos hosts da rodada e nos dois motores:
 *   as sete rotas (`api/onboarding/{options,organizations,slug-availability,status}` e
 *   `api/auth/owner-{register,verification,account}`) respondem o contrato fechado e não escrevem nada.
 * - Cadastro ligado, numa fixture isolada (banco, papéis e API próprios): no motor `better-auth` o dono se cadastra,
 *   confirma o e-mail pelo link real (dublê do Resend), entra, consulta o endereço, cria a locadora com
 *   `Idempotency-Key` e lê o checklist; no motor `legacy` a configuração é recusada (o cadastro exige Better Auth).
 * Captcha (Siteverify) e senha vazada (faixa do HIBP) são dublês de loopback; nenhum provedor real é chamado.
 */
const original = inject('apiParity')
const appOrigin = 'https://app.platform.test'
const run = randomUUID().replaceAll('-', '').slice(0, 12)
const captchaToken = `fixture-captcha-${run}`
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const privateHeaders = {
  cache: 'private, no-store',
  vary: `${frameworkVary}, Cookie, Host`,
}
const failure = (code: string) => ({
  error: 'Não foi possível concluir esta etapa do cadastro.',
  code,
})
const edge = (ip: string) => ({
  'x-platform-edge-auth': original.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': appOrigin,
  'x-platform-client-ip': ip,
})

async function call(
  origin: string,
  pathname: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    jar?: string
  } = {}
) {
  const response = await fetch(origin + pathname, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.jar ? { Cookie: init.jar } : {}),
      ...(init.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers,
    },
    ...(init.body !== undefined
      ? {
          body:
            typeof init.body === 'string'
              ? init.body
              : JSON.stringify(init.body),
        }
      : {}),
    redirect: 'manual',
  })
  const text = await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    retryAfter: response.headers.get('retry-after'),
    cookie: response.headers.get('set-cookie'),
  }
}

describe(`${original.identity.mode} — cadastro de locadora desligado (padrão)`, () => {
  let jar = ''
  beforeAll(async () => {
    jar = await signInParityUser(original, edge(original.directory.ips[40]!), 0)
  })
  for (const origin of parityTargets(original)) {
    const host = origin === original.legacy ? 'raiz legada' : 'API'
    const app = edge(original.directory.ips[41]!)
    it(`${host}: GET options publica só mode off`, async () => {
      expect(
        await call(origin, '/api/onboarding/options', { headers: app })
      ).toEqual({
        status: 200,
        body: { mode: 'off' },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
    })
    it(`${host}: sem sessão, disponibilidade, criação e conta pedem login`, async () => {
      for (const [method, pathname, body] of [
        ['GET', '/api/onboarding/slug-availability?slug=livre', undefined],
        ['POST', '/api/onboarding/organizations', '{}'],
        ['GET', '/api/auth/owner-account', undefined],
        ['POST', '/api/auth/owner-verification', '{}'],
      ] as const)
        expect(
          await call(origin, pathname, {
            method,
            body,
            headers: { ...app, Origin: appOrigin },
          })
        ).toEqual({
          status: 401,
          body: { error: 'Authentication required' },
          ...privateHeaders,
          retryAfter: null,
          cookie: null,
        })
    })
    it(`${host}: com sessão, o cadastro desligado recusa antes de ler o corpo`, async () => {
      const refused = {
        status: 403,
        body: failure('SELF_SERVICE_SIGNUP_DISABLED'),
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      }
      expect(
        await call(origin, '/api/onboarding/slug-availability?slug=livre', {
          jar,
          headers: app,
        })
      ).toEqual(refused)
      expect(
        await call(origin, '/api/onboarding/organizations', {
          method: 'POST',
          jar,
          body: '{',
          headers: {
            ...app,
            Origin: appOrigin,
            'Idempotency-Key': randomUUID(),
          },
        })
      ).toEqual(refused)
      expect(
        await call(origin, '/api/auth/owner-account', { jar, headers: app })
      ).toEqual(refused)
      expect(
        await call(origin, '/api/auth/owner-verification', {
          method: 'POST',
          jar,
          body: {},
          headers: { ...app, Origin: appOrigin },
        })
      ).toEqual(refused)
      expect(
        await call(origin, '/api/auth/owner-register', {
          method: 'POST',
          body: {
            name: 'Dono Sintético',
            email: `owner-off-${run}@example.test`,
            password: `owner-off-${run}-password`,
          },
          headers: {
            ...app,
            Origin: appOrigin,
            'X-Platform-Captcha': captchaToken,
          },
        })
      ).toEqual(refused)
    })
    it(`${host}: origem irmã é recusada antes da sessão nas mutações`, async () => {
      for (const pathname of [
        '/api/onboarding/organizations',
        '/api/auth/owner-verification',
      ])
        expect(
          (
            await call(origin, pathname, {
              method: 'POST',
              jar,
              body: '{}',
              headers: { ...app, Origin: 'https://bravo.platform.test' },
            })
          ).status
        ).toBe(403)
    })
    it(`${host}: o checklist exige o dono (ADMIN) da locadora selecionada`, async () => {
      expect(
        await call(origin, '/api/onboarding/status', {
          jar,
          headers: { ...app, 'x-tenant-id': original.alfa.id },
        })
      ).toEqual({
        status: 403,
        body: { error: 'Owner required', code: 'OWNER_REQUIRED' },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
    })
  }
})

describe(`${original.identity.mode} — cadastro de locadora ligado (fixture isolada)`, () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'locadora-onboarding-http-'))
  const resendKey = `re_local_onboarding_${run}`
  const compromised = `compromised-${run}-password`
  const owner = {
    name: 'Dona Sintética',
    email: `owner-${run}@example.test`,
    password: `owner-${run}-strong-password`,
  }
  const siteverify: Array<{ secret: string; response: string }> = []
  let resend: Awaited<ReturnType<typeof startResendFixture>>
  let fixture: Awaited<ReturnType<typeof startReceivingAccountFixture>>
  let version = ''
  const ips = () => fixture.context.directory.ips
  const app = (index = 44) => edge(ips()[index]!)

  beforeAll(async () => {
    resend = await startResendFixture(resendKey)
    const publication = path.join(temp, 'publication.json')
    const contents = path.join(temp, 'contents.json')
    const identityToken = path.join(temp, 'never-read-identity-token')
    writeFileSync(publication, JSON.stringify(onboardingPublication))
    writeFileSync(
      contents,
      JSON.stringify(
        Object.fromEntries(
          onboardingPublication.map((row) => [
            row.kind,
            'Synthetic test only:' + row.kind,
          ])
        )
      )
    )
    writeFileSync(identityToken, 'synthetic-never-read')
    const pwnedSuffix = createHash('sha1')
      .update(compromised, 'utf8')
      .digest('hex')
      .toUpperCase()
    fixture = await startReceivingAccountFixture(original, {
      interceptHosts: ['challenges.cloudflare.com', 'api.pwnedpasswords.com'],
      async provider(url, init) {
        const target = new URL(url)
        if (target.hostname === 'challenges.cloudflare.com') {
          const body = JSON.parse(String(init.body)) as {
            secret: string
            response: string
          }
          siteverify.push({ secret: body.secret, response: body.response })
          return Response.json({
            success: body.response === captchaToken,
            hostname: 'app.platform.test',
            action: 'onboarding',
          })
        }
        if (target.hostname === 'api.pwnedpasswords.com') {
          const prefix = target.pathname.split('/').pop()!.toUpperCase()
          const lines = ['0'.repeat(35) + ':0', 'F'.repeat(35) + ':3']
          if (pwnedSuffix.startsWith(prefix))
            lines.push(pwnedSuffix.slice(5) + ':7')
          return new Response(lines.join('\r\n'), {
            headers: { 'Content-Type': 'text/plain' },
          })
        }
        return Response.json({}, { status: 404 })
      },
      env: {
        PLATFORM_SELF_SERVICE_SIGNUP: 'on',
        PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
        PLATFORM_SECRETS_KEK_CURRENT: '',
        PLATFORM_SECRETS_KEK_K1: '',
        PLATFORM_SECRETS_KMS_KEY_ARN:
          'arn:aws:kms:sa-east-1:000000000000:key/00000000-0000-4000-8000-000000000000',
        AWS_ROLE_ARN: 'arn:aws:iam::000000000000:role/synthetic-onboarding',
        AWS_WEB_IDENTITY_TOKEN_FILE: identityToken,
        PLATFORM_CAPTCHA_SECRET_KEY: `synthetic-captcha-secret-${run}`,
        PLATFORM_CAPTCHA_SITE_KEY: 'synthetic-site-key',
        PLATFORM_LEGAL_DOCUMENTS_FILE: publication,
        PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE: contents,
        PLATFORM_TRIAL_SECRET: `synthetic-onboarding-trial-${run}-over32`,
        RESEND_API_KEY: resendKey,
        RESEND_BASE_URL: resend.origin,
        FROM_EMAIL: 'Plataforma <no-reply@platform.test>',
      },
    })
    const scope = createPlatformScope(fixture.platform)
    version = await scope.withPlatformTransaction(async (tx) => {
      const seed = await tx.planVersion.findFirstOrThrow()
      const plan = await tx.plan.create({
        data: {
          code: 'onb-http-' + run.slice(0, 8),
          name: 'Synthetic onboarding HTTP',
          isPublic: true,
        },
      })
      return (
        await tx.planVersion.create({
          data: {
            planId: plan.id,
            version: 1,
            amount: '123.45',
            trialDays: 14,
            sellableFrom: new Date(Date.now() - 86_400_000),
            entitlements: seed.entitlements as object,
          },
        })
      ).id
    })
    // The assisted owner has a real subscription before the checklist is read.
    // Keep this seed local: the receiving-account fixture also tests tenants without one.
    await scope.withPlatformTransaction((tx) =>
      tx.subscription.create({
        data: {
          tenantId: fixture.owners[0]!.tenantId,
          planVersionId: version,
          status: 'ACTIVE',
        },
      })
    )
  }, 240_000)

  afterAll(async () => {
    await fixture?.stop()
    await resend?.close()
    // Só os três arquivos escritos aqui e a pasta vazia (nada recursivo).
    for (const name of [
      'publication.json',
      'contents.json',
      'never-read-identity-token',
    ])
      rmSync(path.join(temp, name), { force: true })
    rmdirSync(temp)
  }, 30_000)

  it('o dono assistido lê o checklist da própria locadora com o cadastro ligado ou não', async () => {
    const owners = fixture.owners
    const jar = await signInParityUser(fixture.context, app(45), 0)
    for (const origin of parityTargets(fixture.context)) {
      const response = await call(origin, '/api/onboarding/status', {
        jar,
        headers: { ...app(45), 'x-tenant-id': owners[0]!.tenantId },
      })
      expect(response).toEqual({
        status: 200,
        body: {
          subscriptionStatus: 'ACTIVE',
          items: [
            { id: 'ACCOUNT_CREATED', done: true },
            { id: 'FIRST_EQUIPMENT', done: false },
            { id: 'CUSTOMIZE_SITE', done: false },
            { id: 'PUBLISH_SITE', done: false },
            { id: 'ACTIVATE_ONLINE_PAYMENTS', done: false },
          ],
        },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
    }
  })

  if (original.identity.mode === 'legacy')
    it('no motor legacy a configuração ligada é recusada em todas as rotas do cadastro', async () => {
      for (const origin of parityTargets(fixture.context)) {
        expect(
          await call(origin, '/api/onboarding/options', { headers: app() })
        ).toEqual({
          status: 503,
          body: failure('ONBOARDING_CONFIGURATION_INVALID'),
          ...privateHeaders,
          retryAfter: null,
          cookie: null,
        })
        expect(
          await call(origin, '/api/auth/owner-register', {
            method: 'POST',
            body: owner,
            headers: {
              ...app(),
              Origin: appOrigin,
              'X-Platform-Captcha': captchaToken,
            },
          })
        ).toEqual({
          status: 503,
          body: failure('ONBOARDING_CONFIGURATION_INVALID'),
          ...privateHeaders,
          retryAfter: null,
          cookie: null,
        })
      }
      expect(siteverify).toEqual([])
      expect(await emailsTo(resend.origin, owner.email)).toEqual([])
    })

  if (original.identity.mode === 'better-auth')
    it('dono cria a conta, confirma o e-mail, entra e cria a locadora uma vez só', async () => {
      const api = fixture.context.api
      const register = (body: unknown, captcha?: string, ip = 46) =>
        call(api, '/api/auth/owner-register', {
          method: 'POST',
          body,
          headers: {
            ...app(ip),
            Origin: appOrigin,
            ...(captcha ? { 'X-Platform-Captcha': captcha } : {}),
          },
        })
      // 1. Opções publicadas: textos aprovados e chave pública do captcha, nada de segredo.
      const options = await call(api, '/api/onboarding/options', {
        headers: app(),
      })
      expect(options).toEqual({
        status: 200,
        body: {
          mode: 'on',
          rootDomain: 'platform.test',
          captchaSiteKey: 'synthetic-site-key',
          documents: onboardingPublication.map((row) => ({
            ...row,
            text: 'Synthetic test only:' + row.kind,
          })),
        },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
      // 2. Captcha ausente e senha vazada recusam antes de criar a conta.
      expect(await register(owner)).toMatchObject({
        status: 400,
        body: failure('CAPTCHA_REQUIRED'),
      })
      expect(
        await register(
          {
            ...owner,
            email: `leaked-${run}@example.test`,
            password: compromised,
          },
          captchaToken,
          47
        )
      ).toMatchObject({ status: 422, body: failure('PASSWORD_COMPROMISED') })
      expect(
        await fixture.prisma.user.count({
          where: { email: { in: [owner.email, `leaked-${run}@example.test`] } },
        })
      ).toBe(0)
      // 3. Cadastro aceito: resposta neutra e e-mail de confirmação com o link do app.
      expect(await register(owner, captchaToken, 48)).toEqual({
        status: 202,
        body: {
          message: 'Pedido recebido. Confira seu e-mail para continuar.',
        },
        ...privateHeaders,
        retryAfter: '60',
        cookie: null,
      })
      expect(siteverify.at(-1)).toEqual({
        secret: `synthetic-captcha-secret-${run}`,
        response: captchaToken,
      })
      await expect
        .poll(async () => (await emailsTo(resend.origin, owner.email)).length, {
          timeout: 15_000,
        })
        .toBe(1)
      const [email] = await emailsTo(resend.origin, owner.email)
      const link = emailLinks(email!)
        .map((value) => new URL(value))
        .find((value) => value.origin === appOrigin)
      expect(link).toBeDefined()
      const user = await fixture.prisma.user.findUniqueOrThrow({
        where: { email: owner.email },
      })
      expect(user.authEmailVerified).toBe(false)
      // 4. O link real confirma o e-mail no motor.
      const verified = await fetch(`${api}${link!.pathname}${link!.search}`, {
        headers: app(49),
        redirect: 'manual',
      })
      expect([200, 302, 303, 307]).toContain(verified.status)
      expect(
        (
          await fixture.prisma.user.findUniqueOrThrow({
            where: { id: user.id },
          })
        ).authEmailVerified
      ).toBe(true)
      // 5. Login real e leitura da própria conta; o reenvio de confirmação fica neutro.
      const signIn = await fetch(`${api}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          ...app(50),
          'x-forwarded-for': ips()[50]!,
          Origin: appOrigin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: owner.email, password: owner.password }),
        redirect: 'manual',
      })
      expect(signIn.status).toBe(200)
      const jar = sessionCookies(signIn)
      expect(jar).toContain('__Host-locadora.session_token=')
      expect(
        await call(api, '/api/auth/owner-account', { jar, headers: app(51) })
      ).toEqual({
        status: 200,
        body: { userId: user.id, emailVerified: true },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
      expect(
        await call(api, '/api/auth/owner-verification', {
          method: 'POST',
          jar,
          body: {},
          headers: { ...app(51), Origin: appOrigin },
        })
      ).toEqual({
        status: 202,
        body: {
          message: 'Pedido recebido. Confira seu e-mail para continuar.',
        },
        ...privateHeaders,
        retryAfter: '60',
        cookie: null,
      })
      // 6. Endereço livre e endereço já usado (com sugestões).
      const slug = `onb-${run}`
      expect(
        await call(api, `/api/onboarding/slug-availability?slug=${slug}`, {
          jar,
          headers: app(52),
        })
      ).toEqual({
        status: 200,
        body: { available: true },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
      const taken = await call(
        api,
        `/api/onboarding/slug-availability?slug=${fixture.owners[0]!.tenantId}`,
        { jar, headers: app(52) }
      )
      expect(taken).toMatchObject({ status: 200, body: { available: false } })
      // 7. Criação com Idempotency-Key e captcha; a repetição devolve o mesmo recibo sem novo agregado.
      const key = randomUUID()
      const create = () =>
        call(api, '/api/onboarding/organizations', {
          method: 'POST',
          jar,
          body: onboardingInput(version, slug, '11222333000181'),
          headers: {
            ...app(53),
            Origin: appOrigin,
            'Idempotency-Key': key,
            'X-Platform-Captcha': captchaToken,
          },
        })
      const created = await create()
      expect(created).toMatchObject({
        status: 201,
        body: {
          organization: { slug, name: 'Synthetic Rental' },
          subscription: { status: 'TRIALING' },
        },
        cache: 'private, no-store',
      })
      expect(created.cookie).toContain('selected-tenant-id=')
      const replay = await create()
      expect(replay.status).toBe(201)
      expect(replay.body).toEqual(created.body)
      const tenantId = created.body.organization.id as string
      expect(
        await fixture.prisma.membership.findMany({
          where: { tenantId },
          select: { userId: true, role: true, status: true },
        })
      ).toEqual([{ userId: user.id, role: 'ADMIN', status: 'ACTIVE' }])
      // 8. Checklist da locadora nova pelo dono.
      const status = await call(api, '/api/onboarding/status', {
        jar,
        headers: { ...app(54), 'x-tenant-id': tenantId },
      })
      expect(status).toEqual({
        status: 200,
        body: {
          subscriptionStatus: 'TRIALING',
          items: [
            { id: 'ACCOUNT_CREATED', done: true },
            { id: 'FIRST_EQUIPMENT', done: false },
            { id: 'CUSTOMIZE_SITE', done: true },
            { id: 'PUBLISH_SITE', done: false },
            { id: 'ACTIVATE_ONLINE_PAYMENTS', done: false },
            { id: 'SUBSCRIBE', done: false },
          ],
        },
        ...privateHeaders,
        retryAfter: null,
        cookie: null,
      })
    })
})
