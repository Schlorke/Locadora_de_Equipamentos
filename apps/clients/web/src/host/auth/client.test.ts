// Cliente de autenticação do host web (achado 113 da revisão adversarial): o basePath do Better Auth sai da regra única
// modo → basePath de @gb-locacoes/contracts/platform (a mesma do proxy, do app mobile e do backend) em vez de repetir o
// mapeamento, e o modo sai da mesma validação do proxy (host/auth/mode).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAdminIndexRedirect } from '@gb-locacoes/frontend/pages/admin-entrada'

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn((_options: { basePath?: string }) => ({
    getSession: vi.fn(async () => ({ data: null, error: null })),
    signIn: { email: vi.fn(), social: vi.fn() },
    signOut: vi.fn(),
  })),
  nextAuthGetSession: vi.fn(async () => null),
  basePath: vi.fn(),
}))

vi.mock('better-auth/react', () => ({ createAuthClient: mocks.createAuthClient }))
vi.mock('next-auth/react', () => ({ getSession: mocks.nextAuthGetSession, signIn: vi.fn(), signOut: vi.fn() }))
vi.mock('@gb-locacoes/contracts/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@gb-locacoes/contracts/platform')>()
  mocks.basePath.mockImplementation(actual.betterAuthBasePath)
  return { ...actual, betterAuthBasePath: mocks.basePath }
})

async function loadClient(mode: string | undefined) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', mode)
  return import('./client')
}

beforeEach(() => {
  mocks.createAuthClient.mockClear()
  mocks.nextAuthGetSession.mockClear()
  // Um caso deixa um JWT legado no NextAuth; os demais começam sem sessão.
  mocks.nextAuthGetSession.mockImplementation(async () => null)
  mocks.basePath.mockClear()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('hostAuth do host web: basePath do Better Auth pela regra única', () => {
  it.each([
    ['better-auth', '/api/auth'],
    ['better-auth-v2', '/api/auth/v2'],
  ] as const)('%s: o cliente nasce no basePath que a regra dá ao modo (%s)', async (mode, base) => {
    const { hostAuth } = await loadClient(mode)
    await hostAuth.getSession()
    expect(mocks.basePath).toHaveBeenCalledWith(mode)
    expect(mocks.createAuthClient).toHaveBeenCalledTimes(1)
    expect(mocks.createAuthClient).toHaveBeenLastCalledWith({ basePath: base })
  })

  it('a regra é consultada, não repetida: o basePath que ela devolve é o do cliente', async () => {
    // Resposta que um mapeamento repetido no cliente não daria para o modo better-auth.
    mocks.basePath.mockReturnValueOnce('/api/auth/v2')
    await loadClient('better-auth')
    expect(mocks.basePath).toHaveBeenCalledWith('better-auth')
    expect(mocks.createAuthClient).toHaveBeenLastCalledWith({ basePath: '/api/auth/v2' })
  })

  it('legacy: a regra não dá basePath do Better Auth e a sessão vem do NextAuth', async () => {
    const { hostAuth } = await loadClient('legacy')
    expect(mocks.basePath).toHaveBeenCalledWith('legacy')
    expect(mocks.createAuthClient).toHaveBeenLastCalledWith({ basePath: undefined })
    expect(await hostAuth.getSession()).toBeNull()
    expect(mocks.nextAuthGetSession).toHaveBeenCalledTimes(1)
    const client = mocks.createAuthClient.mock.results.at(-1)!.value as { getSession: ReturnType<typeof vi.fn> }
    expect(client.getSession).not.toHaveBeenCalled()
  })

  // E27a (onda 135): o portão do painel no host web depois do corte. A raiz legada provava "o proxy ignora o JWT do
  // NextAuth em better-auth"; no host web quem decide /admin é a sessão deste cliente, lida pelo índice do painel com
  // resolveAdminIndexRedirect. Um JWT do NextAuth que sobrou no navegador nunca é lido nem abre o painel.
  it.each([
    ['sem sessão no Better Auth', { data: null, error: null }],
    ['Better Auth indisponível', { data: null, error: { message: 'indisponível' } }],
  ] as const)('better-auth, %s: o NextAuth não é consultado e o portão do painel manda ao login', async (_case, answer) => {
    mocks.nextAuthGetSession.mockResolvedValue({ user: { id: 'jwt-legado', email: 'equipe@example.test' } } as never)
    const { hostAuth } = await loadClient('better-auth')
    const client = mocks.createAuthClient.mock.results.at(-1)!.value as { getSession: ReturnType<typeof vi.fn> }
    client.getSession.mockResolvedValueOnce(answer)
    // Como o índice do painel (app/(admin)/admin/page.tsx): erro de sessão conta como sem sessão.
    const signedIn = await hostAuth.getSession().then(
      (session) => Boolean(session?.user),
      () => false
    )
    expect(signedIn).toBe(false)
    expect(resolveAdminIndexRedirect('unauthenticated', signedIn)).toBe('/admin/login')
    expect(client.getSession).toHaveBeenCalledTimes(1)
    expect(mocks.nextAuthGetSession).not.toHaveBeenCalled()
  })

  it('better-auth com sessão do Better Auth: o painel abre pela sessão nova, sem o NextAuth', async () => {
    const { hostAuth } = await loadClient('better-auth')
    const client = mocks.createAuthClient.mock.results.at(-1)!.value as { getSession: ReturnType<typeof vi.fn> }
    client.getSession.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'equipe@example.test', name: 'Ana', role: 'ADMIN' } },
      error: null,
    })
    const session = await hostAuth.getSession()
    expect(session).toEqual({ user: { id: 'u1', email: 'equipe@example.test', name: 'Ana', role: 'ADMIN' } })
    expect(resolveAdminIndexRedirect('authenticated', Boolean(session?.user))).toBe('/admin/dashboard')
    expect(mocks.nextAuthGetSession).not.toHaveBeenCalled()
  })

  it('sem modo vale o legacy, e modo desconhecido é recusado pela mesma validação do proxy', async () => {
    await loadClient(undefined)
    expect(mocks.basePath).toHaveBeenCalledWith('legacy')
    await expect(loadClient('magic-link')).rejects.toThrow('NEXT_PUBLIC_AUTH_MODE inválido.')
  })
})
