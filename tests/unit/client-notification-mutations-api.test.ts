import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import {
  PATCH as servicePatch,
  DELETE as serviceDelete,
} from '../../apps/services/api/src/app/api/client/notifications/[id]/route'
import { POST as serviceAll } from '../../apps/services/api/src/app/api/client/notifications/mark-all-read/route'

const principal = {
  tenantId: 'fixture-tenant',
  userId: 'fixture-user',
  membershipId: 'fixture-member',
  role: 'CLIENT' as const,
}
const scope = { tenantId: principal.tenantId, userId: principal.userId }
const now = new Date('2026-01-11T12:13:14.000Z')
const row = {
  id: 'fixture-notification',
  ...scope,
  type: 'QUOTE',
  title: 'Private notification',
  message: 'Private message',
  priority: 'HIGH',
  metadata: { amount: '1.25' },
  actionUrl: null,
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}
const context = () => ({ params: Promise.resolve({ id: row.id }) })
const handlers = [['service', servicePatch, serviceDelete, serviceAll]] as const
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://app.platform.test')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.notification.findFirst.mockResolvedValue(row)
  state.tx.notification.update.mockImplementation(async ({ data }) => ({
    ...row,
    ...data,
  }))
  state.tx.notification.delete.mockResolvedValue(row)
  state.tx.notification.updateMany.mockResolvedValue({ count: 3 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe.each(handlers)(
  '%s client notification mutations characterization',
  (_host, PATCH, DELETE, POST) => {
    describe.each(['PATCH', 'DELETE', 'POST'] as const)('%s', (method) => {
      const input = (
        headers: Record<string, string> = {},
        query = '',
        body?: string
      ) =>
        new NextRequest(
          `https://app.platform.test/api/client/notifications/${method === 'POST' ? 'mark-all-read' : row.id}${query}`,
          { method, headers, body }
        )
      const invoke = (request = input(), params = context()) =>
        method === 'POST'
          ? POST(request)
          : method === 'PATCH'
            ? PATCH(request, params)
            : DELETE(request, params)
      it.each([400, 401, 403, 404, 409, 503])(
        'preserves refusal %i before transaction/effects',
        async (status) => {
          const response = Response.json(
            { error: 'fixture-refused' },
            { status }
          )
          state.principal.mockResolvedValue({ ok: false, response })
          expect(
            await invoke(input({ Origin: 'https://foreign.platform.test' }))
          ).toBe(response)
          expect(state.transaction).not.toHaveBeenCalled()
          expect(state.tx.notification.findFirst).not.toHaveBeenCalled()
          expect(state.tx.notification.updateMany).not.toHaveBeenCalled()
        }
      )
      it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
        'keeps recipient ownership for membership %s',
        async (role) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role },
          })
          const request = input()
          const response = await invoke(request)
          expect(state.principal).toHaveBeenCalledExactlyOnceWith(request)
          expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
          expect(response.status).toBe(200)
          expect(response.headers.get('cache-control')).toBeNull()
          expect(response.headers.get('set-cookie')).toBeNull()
          if (method === 'POST') {
            expect(state.tx.notification.findFirst).not.toHaveBeenCalled()
            expect(
              state.tx.notification.updateMany
            ).toHaveBeenCalledExactlyOnceWith({
              where: { ...scope, isRead: false },
              data: { isRead: true, readAt: now },
            })
            expect(await response.json()).toEqual({
              success: true,
              updated: 3,
              message: '3 notificação(ões) marcada(s) como lida(s)',
            })
          } else {
            expect(
              state.tx.notification.findFirst
            ).toHaveBeenCalledExactlyOnceWith({
              where: { ...scope, id: row.id },
            })
            if (method === 'PATCH') {
              expect(
                state.tx.notification.update
              ).toHaveBeenCalledExactlyOnceWith({
                where: { ...scope, id: row.id },
                data: { isRead: true, readAt: now },
              })
              expect(await response.json()).toEqual({
                success: true,
                notification: {
                  ...row,
                  createdAt: row.createdAt.toISOString(),
                  isRead: true,
                  readAt: now.toISOString(),
                },
              })
            } else {
              expect(
                state.tx.notification.delete
              ).toHaveBeenCalledExactlyOnceWith({
                where: { ...scope, id: row.id },
              })
              expect(await response.json()).toEqual({
                success: true,
                message: 'Notificação removida com sucesso',
              })
            }
          }
        }
      )
      it.each([
        {
          Origin: 'https://foreign.platform.test',
          'Sec-Fetch-Site': 'same-site',
        },
        { Origin: 'null' },
        { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'cross-site' },
        { 'Sec-Fetch-Site': 'same-site' },
      ])('refuses browser origin %j before RLS or writes', async (headers) => {
        const response = await invoke(input(headers))
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Origem não permitida' })
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(state.transaction).not.toHaveBeenCalled()
        expect(state.tx.notification.update).not.toHaveBeenCalled()
        expect(state.tx.notification.delete).not.toHaveBeenCalled()
        expect(state.tx.notification.updateMany).not.toHaveBeenCalled()
      })
      it.each([
        {},
        {
          Origin: 'https://app.platform.test',
          'Sec-Fetch-Site': 'same-origin',
        },
        { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'none' },
      ])('accepts native or same-origin transport %j', async (headers) => {
        expect((await invoke(input(headers))).status).toBe(200)
      })
      it.each([
        'invalid-json',
        '{"userId":"foreign","tenantId":"foreign","isRead":false,"id":"foreign"}',
        '',
      ])(
        'ignores request body and ownership/query overrides: %s',
        async (body) => {
          expect(
            (
              await invoke(
                input(
                  { 'Content-Type': 'application/json' },
                  '?userId=foreign&tenantId=foreign&id=foreign&type=PAYMENT',
                  body
                )
              )
            ).status
          ).toBe(200)
          if (method === 'POST')
            expect(
              state.tx.notification.updateMany.mock.calls[0]![0].where
            ).toEqual({ ...scope, isRead: false })
          else
            expect(
              state.tx.notification.findFirst.mock.calls[0]![0].where
            ).toEqual({ ...scope, id: row.id })
        }
      )
      it.each(['principal', 'transaction', 'rls', 'write'])(
        'sanitizes failure at %s',
        async (step) => {
          const error = new Error('fixture-private-connection')
          if (step === 'principal') state.principal.mockRejectedValue(error)
          if (step === 'transaction') state.transaction.mockRejectedValue(error)
          if (step === 'rls') state.tx.$queryRaw.mockRejectedValue(error)
          if (step === 'write')
            state.tx.notification[
              method === 'POST'
                ? 'updateMany'
                : method === 'PATCH'
                  ? 'update'
                  : 'delete'
            ].mockRejectedValue(error)
          const response = await invoke()
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error: 'Erro interno do servidor',
          })
          expect(console.error).toHaveBeenCalledExactlyOnceWith(
            'Client portal operation failed'
          )
          if (step === 'rls') {
            expect(state.tx.notification.findFirst).not.toHaveBeenCalled()
            expect(state.tx.notification.updateMany).not.toHaveBeenCalled()
          }
        }
      )
      if (method !== 'POST') {
        it('returns neutral 404 for a missing, foreign or unassigned notification without writing', async () => {
          state.tx.notification.findFirst.mockResolvedValue(null)
          const response = await invoke()
          expect(response.status).toBe(404)
          expect(await response.json()).toEqual({
            error: 'Notificação não encontrada',
          })
          expect(state.tx.notification.update).not.toHaveBeenCalled()
          expect(state.tx.notification.delete).not.toHaveBeenCalled()
        })
        it('awaits route params only inside the transaction after RLS', async () => {
          let resolve!: (value: { id: string }) => void
          const params = new Promise<{ id: string }>((done) => {
            resolve = done
          })
          const response = invoke(input(), { params })
          await vi.waitFor(() =>
            expect(state.tx.$queryRaw).toHaveBeenCalledTimes(1)
          )
          expect(state.tx.notification.findFirst).not.toHaveBeenCalled()
          resolve({ id: 'non-uuid-id' })
          expect((await response).status).toBe(200)
          expect(
            state.tx.notification.findFirst.mock.calls[0]![0].where.id
          ).toBe('non-uuid-id')
        })
        it('sanitizes a failed ownership lookup without a write', async () => {
          state.tx.notification.findFirst.mockRejectedValue(
            new Error('fixture-private-select')
          )
          const response = await invoke()
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error: 'Erro interno do servidor',
          })
          expect(state.tx.notification.update).not.toHaveBeenCalled()
          expect(state.tx.notification.delete).not.toHaveBeenCalled()
        })
      } else {
        it.each([0, 1, 17])(
          'preserves affected-row count %i and message',
          async (count) => {
            state.tx.notification.updateMany.mockResolvedValue({ count })
            expect(await (await invoke()).json()).toEqual({
              success: true,
              updated: count,
              message: `${count} notificação(ões) marcada(s) como lida(s)`,
            })
          }
        )
      }
      if (method === 'PATCH')
        it('repeated mark-read refreshes readAt even for an already-read notification', async () => {
          state.tx.notification.findFirst.mockResolvedValue({
            ...row,
            isRead: true,
            readAt: row.createdAt,
          })
          expect((await invoke()).status).toBe(200)
          vi.setSystemTime(new Date('2026-01-12T00:00:00Z'))
          expect((await invoke()).status).toBe(200)
          expect(
            state.tx.notification.update.mock.calls.map((call) =>
              call[0].data.readAt.toISOString()
            )
          ).toEqual([now.toISOString(), '2026-01-12T00:00:00.000Z'])
        })
    })
  }
)
