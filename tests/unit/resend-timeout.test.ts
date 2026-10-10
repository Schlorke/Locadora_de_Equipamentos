import { afterEach, describe, expect, it, vi } from 'vitest'
import { createResendClient } from '@gb-locacoes/backend/runtime'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
// Contraparte da API compartilhada (onda 135, B5): o serviço monta o cliente pelo runtime do backend com a chave do
// ambiente (`apps/services/api/src/host/credential-accounts.ts`, `host/session.ts`).
describe.each([
  ['service', () => createResendClient(process.env.RESEND_API_KEY)],
] as const)('%s', (_host, getResend) => {
  describe('bounded mail transport', () => {
    it('reads the configured key at call time and returns a fresh client only when configured', () => {
      vi.stubEnv('RESEND_API_KEY', '')
      expect(getResend()).toBeNull()
      vi.stubEnv('RESEND_API_KEY', 're_test_only')
      const first = getResend()
      expect(first).not.toBeNull()
      expect(getResend()).not.toBe(first)
      vi.stubEnv('RESEND_API_KEY', '')
      expect(getResend()).toBeNull()
    })

    it('honors a caller cancellation while also applying the SDK deadline', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_only')
      const deadline = new AbortController()
      const caller = new AbortController()
      const timeout = vi
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValue(deadline.signal)
      let combined: AbortSignal | null = null
      const fetch = vi.fn((_url: unknown, options: RequestInit) => {
        combined = options.signal ?? null
        return new Promise<Response>((_resolve, reject) => {
          options.signal!.addEventListener(
            'abort',
            () => reject(options.signal!.reason),
            { once: true }
          )
        })
      })
      vi.stubGlobal('fetch', fetch)
      const pending = getResend()!.fetchRequest('/emails/fixture', {
        method: 'GET',
        signal: caller.signal,
      })
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      expect(timeout).toHaveBeenCalledWith(15000)
      expect(combined).not.toBe(caller.signal)
      expect(combined).not.toBe(deadline.signal)
      caller.abort(new DOMException('Caller canceled', 'AbortError'))
      const result = await pending
      expect(combined!.aborted).toBe(true)
      expect(combined!.reason).toBe(caller.signal.reason)
      expect(deadline.signal.aborted).toBe(false)
      expect(result.error).not.toBeNull()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('aborts the actual SDK fetch after its deadline while preserving idempotency', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_only')
      const controller = new AbortController()
      const timeout = vi
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValue(controller.signal)
      let receivedSignal: AbortSignal | null = null
      const fetch = vi.fn((_url: unknown, options: RequestInit) => {
        receivedSignal = options.signal ?? null
        return new Promise<Response>((_resolve, reject) =>
          options.signal!.addEventListener(
            'abort',
            () => reject(options.signal!.reason),
            { once: true }
          )
        )
      })
      vi.stubGlobal('fetch', fetch)
      const pending = getResend()!.emails.send(
        {
          from: 'Sender <sender@example.test>',
          to: 'recipient@example.test',
          subject: 'test',
          html: '<p>test</p>',
        },
        { idempotencyKey: 'tenant-event:fixture' }
      )
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
      expect(timeout).toHaveBeenCalledWith(15000)
      expect(receivedSignal).toBe(controller.signal)
      expect(
        new Headers(fetch.mock.calls[0]![1].headers).get('idempotency-key')
      ).toBe('tenant-event:fixture')
      controller.abort(new DOMException('Deadline expired', 'TimeoutError'))
      const result = await pending
      expect(controller.signal.aborted).toBe(true)
      expect(result.error).not.toBeNull()
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})
