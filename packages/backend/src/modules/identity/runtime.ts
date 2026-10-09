import type { PrismaClient } from '@prisma/client'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { createIdentity, type Identity } from './factory'
import {
  identityConfiguration,
  identityEnabled,
  type IdentityConfiguration,
} from './configuration'
import {
  AUTH_UNAVAILABLE_RETRY_SECONDS,
  type LegacySignInGuard,
} from './legacy-credentials'
import { refuseBetterAuthRead } from './engine-read-origin'

/** Assunto dos e-mails de identidade: pertencem à plataforma, nunca a uma locadora. */
export function identitySubject(label: string): string {
  return `${label} - ${PLATFORM.displayName}`
}
/**
 * A requisição como a identidade deve enxergá-la: com a origem pública que a
 * borda validada calculou para o host (locadora ou app), para que o
 * `oauth-proxy`, as origens confiáveis e os links de e-mail usem o host de
 * onde ela veio. Sem borda, segue como chegou. Nunca lê `x-forwarded-*`.
 */
async function identityRequest(
  request: Request,
  config: Pick<IdentityConfiguration, 'readEdge'>
): Promise<Request> {
  const edge = config.readEdge(request)
  if (!edge || (edge.hostKind !== 'tenant' && edge.hostKind !== 'app'))
    return request
  const current = new URL(request.url)
  const target = `${edge.origin}${current.pathname}${current.search}`
  if (target === request.url) return request
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer()
  return new Request(target, {
    method: request.method,
    headers: request.headers,
    body,
    redirect: 'manual',
    signal: request.signal,
  })
}

/**
 * Registra por que a identidade não respondeu, sem segredos e sem corpo: o
 * nome e o código do erro (mensagens do Prisma e do Better Auth podem repetir
 * argumentos, tokens ou e-mails, então nunca entram), o método e só o primeiro
 * segmento do caminho depois da base (o resto pode carregar um token, como em
 * `/reset-password/:token`). Um `PlatformEnvError` entra com a mensagem, que
 * por contrato nunca contém valores.
 */
function logIdentityFailure(request: Request, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined
  let endpoint: string | undefined
  try {
    const segments = new URL(request.url).pathname.split('/').filter(Boolean)
    const base = segments[2] === 'v2' ? 3 : 2
    const first = segments[base]
    endpoint = first && /^[a-z-]{1,40}$/.test(first) ? first : undefined
  } catch {
    endpoint = undefined
  }
  console.error('[identity]', {
    event: 'identity_request_failed',
    method: request.method,
    ...(endpoint === undefined ? {} : { endpoint }),
    error: name,
    ...(code === undefined ? {} : { code }),
    ...(name === 'PlatformEnvError' && error instanceof Error
      ? { detail: error.message }
      : {}),
  })
}

/** Engine lifecycle and request policy; the host supplies real storage, mail and attempt budgets. */
export function createIdentityRuntime(dependencies: {
  environment(): Record<string, string | undefined>
  loadDependencies(): Promise<{
    database: PrismaClient
    send(_subject: string, _email: string, _url: string): Promise<void>
    verificationResendAllowed(_email: string): Promise<boolean>
    signInGuard: LegacySignInGuard
  }>
}) {
  let identity:
    { instance: Identity; config: IdentityConfiguration } | undefined
  async function load() {
    if (!identityEnabled(dependencies.environment()))
      throw new Error('Identity v2 is disabled')
    if (!identity) {
      const config = identityConfiguration(dependencies.environment())
      const ports = await dependencies.loadDependencies()
      identity = {
        config,
        instance: createIdentity(
          ports.database,
          config,
          {
            sendPasswordReset: ({ email, url }) =>
              ports.send(identitySubject('Recuperação de senha'), email, url),
            sendEmailVerification: ({ email, url }) =>
              ports.send(identitySubject('Verifique seu email'), email, url),
            verificationResendAllowed: (email) =>
              ports.verificationResendAllowed(email),
          },
          ports.signInGuard
        ),
      }
    }
    return identity
  }
  async function getIdentity(): Promise<Identity> {
    return (await load()).instance
  }

  async function handleIdentityRequest(request: Request): Promise<Response> {
    if (!identityEnabled(dependencies.environment()))
      return Response.json(
        { error: 'Identity v2 unavailable' },
        { status: 503 }
      )
    try {
      // Leituras com Origin explícito de outra origem: recusadas antes do motor e do banco (engine-read-origin.ts).
      const crossOrigin = refuseBetterAuthRead(
        request,
        dependencies.environment()
      )
      if (crossOrigin) return crossOrigin
      const { instance, config } = await load()
      return await instance.handler(await identityRequest(request, config))
    } catch (error) {
      // A resposta continua fechada e neutra; a causa fica só no log. Inclui o
      // limitador do Better Auth sem banco: 503 com Retry-After, nunca 429.
      logIdentityFailure(request, error)
      return Response.json(
        { error: 'Authentication unavailable' },
        {
          status: 503,
          headers: {
            'Retry-After': String(AUTH_UNAVAILABLE_RETRY_SECONDS),
            'Cache-Control': 'no-store',
          },
        }
      )
    }
  }

  return { getIdentity, handleIdentityRequest }
}
