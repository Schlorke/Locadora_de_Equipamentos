/**
 * Cron de alerta de boleto (app/api/cron/boleto-overdue-alerts): o alerta ao cliente ainda não é enviado por
 * e-mail, então o cron só registra o alerta. O registro sai pelo logger, pelo id do pagamento, e nunca leva o
 * e-mail (ou outro dado pessoal) do cliente para o log.
 */
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ info: [] as unknown[][] }))

vi.mock('@/lib/logger', () => ({
  logger: { info: (...args: unknown[]) => state.info.push(args) },
}))
vi.mock('@/lib/security/tenant-cron', () => ({
  runTenantCron: (
    _request: Request,
    job: (context: { tenantId: string }) => Promise<Response>
  ) => job({ tenantId: 'tenant-a' }),
}))
vi.mock('@/lib/tenant', () => {
  const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000)
  const payments = [
    {
      id: 'payment-rental',
      dueDate: tomorrow,
      amount: '150.00',
      rental: {
        users: {
          email: 'cliente.locacao@example.test',
          name: 'Cliente Locação',
        },
      },
      quote: null,
    },
    {
      id: 'payment-quote',
      dueDate: tomorrow,
      amount: '90.00',
      rental: null,
      quote: {
        user: {
          email: 'cliente.orcamento@example.test',
          name: 'Cliente Orçamento',
        },
      },
    },
  ]
  let call = 0
  return {
    withTenantTransaction: async (
      _context: { tenantId: string },
      run: (tx: unknown) => unknown
    ) =>
      run({
        payment: {
          // Primeira busca: vencem amanhã; segunda: vencidos (nenhum).
          findMany: async () => (call++ % 2 === 0 ? payments : []),
        },
      }),
  }
})
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  ...(await (async () => {
    const F = await (() => ({
      logger: { info: (...args: unknown[]) => state.info.push(args) },
    }))()
    return { createApplicationLogger: () => F.logger }
  })()),
}))
vi.mock('../../apps/services/api/src/host/tenant-cron', () => ({
  runTenantCron: (
    _request: Request,
    job: (context: { tenantId: string }) => Promise<Response>
  ) => job({ tenantId: 'tenant-a' }),
}))
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => {
      const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000)
      const payments = [
        {
          id: 'payment-rental',
          dueDate: tomorrow,
          amount: '150.00',
          rental: {
            users: {
              email: 'cliente.locacao@example.test',
              name: 'Cliente Locação',
            },
          },
          quote: null,
        },
        {
          id: 'payment-quote',
          dueDate: tomorrow,
          amount: '90.00',
          rental: null,
          quote: {
            user: {
              email: 'cliente.orcamento@example.test',
              name: 'Cliente Orçamento',
            },
          },
        },
      ]
      let call = 0
      return {
        withTenantTransaction: async (
          _context: { tenantId: string },
          run: (tx: unknown) => unknown
        ) =>
          run({
            payment: {
              // Primeira busca: vencem amanhã; segunda: vencidos (nenhum).
              findMany: async () => (call++ % 2 === 0 ? payments : []),
            },
          }),
      }
    })()),
  })
)
import * as legacyRoute0 from '@/app/api/cron/boleto-overdue-alerts/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/cron/boleto-overdue-alerts/route'

const HOSTS = [
  [
    'legacy root',
    {
      GET: legacyRoute0.GET,
    },
  ],
  [
    'service',
    {
      GET: serviceRoute0.GET,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { GET }) => {
  afterEach(() => {
    state.info.length = 0
  })

  describe('cron boleto-overdue-alerts', () => {
    it('registra cada alerta pelo id do pagamento, sem o e-mail do cliente no log', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const response = await GET(
        new NextRequest('https://test.invalid/api/cron/boleto-overdue-alerts')
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.results).toMatchObject({
        dueTomorrow: 2,
        overdue: 0,
        emailsSent: 2,
        errors: 0,
      })

      const lines = [...state.info, ...log.mock.calls].map((args) =>
        args.map(String).join(' ')
      )
      expect(state.info.map((args) => String(args[0]))).toEqual([
        '[BOLETO ALERT] Payment payment-rental - Vence amanhã',
        '[BOLETO ALERT] Payment payment-quote - Vence amanhã',
      ])
      expect(lines.join('\n')).not.toMatch(/@example\.test|Cliente/)
      expect(log).not.toHaveBeenCalled()
    })
  })
})
