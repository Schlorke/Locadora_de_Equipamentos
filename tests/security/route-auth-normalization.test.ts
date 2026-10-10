const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return { prisma: {} }
}
/**
 * Contrato HTTP das rotas normalizadas pela regra estrutural do inventário de
 * autorização (achado 108, tests/security/route-auth-inventory.test.ts): o
 * guard passou a ser a primeira instrução do handler, e cada resposta abaixo
 * foi registrada com o código de antes da mudança. A mesma tabela vale depois
 * dela, para quem tem sessão e para quem não tem.
 *
 * - POST /api/admin/rentals/[id]/contract: só ADMIN e OPERATOR geram o
 *   contrato; os demais papéis recebem o mesmo 403 `Acesso negado` que o
 *   serviço já devolvia, agora antes de ler o parâmetro da rota.
 * - GET /api/admin/zoho-mail/oauth/callback: sem sessão, o erro devolvido pelo
 *   Zoho e a falta do código continuam vindo antes do pedido de login.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  zohoTransaction: vi.fn(),
  cookie: '',
  deleted: vi.fn(),
  exchange: vi.fn(),
  mail: vi.fn(),
}))

vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => ({ value: mocks.cookie }),
    delete: mocks.deleted,
  }),
}))

// Contraparte na API compartilhada (onda 135, B5): o mesmo gate e a mesma geração, pela composição do serviço. A regra
// de papel (canManageContracts) é a real do backend; só a identidade e a geração são dublês.
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocks.principal,
}))
vi.mock(
  '../../apps/services/api/src/host/contracts',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/contracts')
    >()),
    generateRentalContract: mocks.transaction,
  })
)

vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: mocks.zohoTransaction,
}))
vi.mock('@gb-locacoes/backend/communications', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@gb-locacoes/backend/communications')>()
  return {
    ...original,
    createZohoMailClient: () => ({
      ...original.createZohoMailClient(),
      exchangeCodeForTokens: mocks.exchange,
      makeZohoMailRequest: mocks.mail,
    }),
  }
})
import { zohoOAuthAuthorizationFailure } from '@gb-locacoes/backend/http'

import { POST as serviceGenerateContract } from '../../apps/services/api/src/app/api/admin/rentals/[id]/contract/route'
import { GET as zohoCallback } from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/callback/route'

const principalOf = (role: string) => ({
  tenantId: 'tenant-A',
  userId: 'user-A',
  membershipId: 'membership-A',
  role,
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.cookie = JSON.stringify({
    state: 'nonce',
    tenantId: 'tenant-B',
    userId: 'user-A',
  })
})

describe.each([['service', serviceGenerateContract]] as const)(
  'POST /api/admin/rentals/[id]/contract (%s)',
  (_host, generateContract) => {
    const call = async () => {
      // Counts how many times the handler awaits the route params.
      const read = vi.fn((resolve: (_value: { id: string }) => void) =>
        resolve({ id: 'rental-1' })
      )
      const response = await generateContract(
        new NextRequest(
          'https://app.plataforma.test/api/admin/rentals/rental-1/contract',
          {
            method: 'POST',
          }
        ),
        { params: { then: read } as unknown as Promise<{ id: string }> }
      )
      return {
        status: response.status,
        body: await response.json(),
        paramsRead: read.mock.calls.length,
      }
    }

    it('without a principal, answers the refusal of the gate and reads nothing', async () => {
      mocks.principal.mockResolvedValue({
        ok: false,
        response: Response.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
      })
      expect(await call()).toEqual({
        status: 401,
        body: { error: 'Authentication required' },
        paramsRead: 0,
      })
      expect(mocks.transaction).not.toHaveBeenCalled()
    })

    it.each(['CLIENT', 'FINANCIAL'])(
      '%s: 403 Acesso negado, the same body as before, without touching the contract',
      async (role) => {
        mocks.principal.mockResolvedValue({
          ok: true,
          principal: principalOf(role),
        })
        const answer = await call()
        expect({ status: answer.status, body: answer.body }).toEqual({
          status: 403,
          body: { error: 'Acesso negado' },
        })
        expect(mocks.transaction).not.toHaveBeenCalled()
      }
    )

    it.each(['ADMIN', 'OPERATOR'])(
      '%s: generates the contract of the rental named by the route',
      async (role) => {
        mocks.principal.mockResolvedValue({
          ok: true,
          principal: principalOf(role),
        })
        mocks.transaction.mockResolvedValue({ id: 'contract-1' })
        expect(await call()).toEqual({
          status: 200,
          body: { contract: { id: 'contract-1' } },
          paramsRead: 1,
        })
        expect(mocks.transaction).toHaveBeenCalledTimes(1)
        expect(mocks.transaction.mock.calls[0]![0]).toEqual(principalOf(role))
      }
    )

    it('a failure of the gate itself is the same 500', async () => {
      mocks.principal.mockRejectedValue(new Error('database unavailable'))
      expect(await call()).toEqual({
        status: 500,
        body: { error: 'Erro ao gerar contrato' },
        paramsRead: 0,
      })
    })
  }
)

describe('GET /api/admin/zoho-mail/oauth/callback', () => {
  const signedIn = {
    success: true,
    user: { id: 'user-A' },
    tenantId: 'tenant-A',
    principal: principalOf('ADMIN'),
  }
  const redirect = (message: string) =>
    `/admin/email?error=${encodeURIComponent(message)}`
  const location = async (query: string) => {
    const response = await zohoCallback(
      new NextRequest(
        `https://app.plataforma.test/api/admin/zoho-mail/oauth/callback${query}`
      )
    )
    expect(response.status).toBe(307)
    return response.headers.get('location')
  }

  // [sessão, query, destino]: registrado com a rota de antes da normalização.
  const table: Array<[string, unknown, string, string]> = [
    [
      'signed in',
      signedIn,
      '?error=access_denied',
      redirect('Acesso negado ao Zoho'),
    ],
    [
      'signed in',
      signedIn,
      '?error=server_error&code=x',
      redirect('server_error'),
    ],
    ['signed in', signedIn, '', redirect('Código de autorização não recebido')],
    [
      'signed in',
      signedIn,
      '?state=nonce',
      redirect('Código de autorização não recebido'),
    ],
    [
      'signed in',
      signedIn,
      '?code=fixture&state=nonce',
      redirect('Estado OAuth inválido para esta locadora'),
    ],
    [
      'no session',
      { success: false, error: 'Unauthorized', status: 401 },
      '?error=access_denied',
      redirect('Acesso negado ao Zoho'),
    ],
    [
      'no session',
      { success: false, error: 'Unauthorized', status: 401 },
      '?error=server_error&code=x',
      redirect('server_error'),
    ],
    [
      'no session',
      { success: false, error: 'Unauthorized', status: 401 },
      '',
      redirect('Código de autorização não recebido'),
    ],
    [
      'no session',
      { success: false, error: 'Unauthorized', status: 401 },
      '?code=fixture&state=nonce',
      redirect('Faça login como admin'),
    ],
    [
      'another refusal',
      { success: false, error: 'Acesso negado', status: 403 },
      '?code=fixture&state=nonce',
      redirect('Acesso negado'),
    ],
    [
      'a refusal without message',
      { success: false, status: 403 },
      '?code=fixture&state=nonce',
      redirect('Erro de autenticação'),
    ],
  ]
  it.each(table)(
    '%s, query %#: the same redirect',
    async (_who, auth, query, expected) => {
      const previous = auth as {
        success: boolean
        principal?: ReturnType<typeof principalOf>
        error?: string
      }
      mocks.principal.mockResolvedValue(
        previous.success
          ? { ok: true, principal: previous.principal }
          : { ok: false, error: previous.error }
      )
      // O resolvedor atual sempre devolve um error; preserve também o contrato
      // histórico da função compartilhada quando um chamador não fornece mensagem.
      if (!previous.success && previous.error === undefined) {
        const refusal = zohoOAuthAuthorizationFailure(
          new Request(
            `https://app.plataforma.test/api/admin/zoho-mail/oauth/callback${query}`
          ),
          undefined
        )
        expect(refusal.status).toBe(307)
        expect(refusal.headers.get('location')).toBe(expected)
      }
      expect(await location(query)).toBe(
        !previous.success && previous.error === undefined
          ? redirect('Acesso negado')
          : expected
      )
      expect(mocks.exchange).not.toHaveBeenCalled()
      expect(mocks.mail).not.toHaveBeenCalled()
      expect(mocks.zohoTransaction).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
    }
  )
})
