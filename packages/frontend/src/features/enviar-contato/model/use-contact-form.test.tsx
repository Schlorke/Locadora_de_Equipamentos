// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiClientProvider } from '../../../shared/api'
import { PublicTenantProvider } from '../../../entities/organizacao'
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('../../../shared/lib/toast', () => ({ toast: notifications }))
import { useContactForm } from './use-contact-form'
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const form = {
  name: 'Cliente',
  email: 'cliente@example.test',
  phone: '(51) 99999-0000',
  company: '',
  equipment: 'Betoneira',
  cpf: '12345678901',
  cnpj: '',
  message: 'Quero alugar uma betoneira.',
}
describe('Shared contact request', () => {
  it('blocks an implicit company and keeps the form', async () => {
    const request = vi.fn()
    const { result } = renderHook(useContactForm, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientProvider client={{ request }}>
          <PublicTenantProvider value={null}>{children}</PublicTenantProvider>
        </ApiClientProvider>
      ),
    })
    act(() => result.current.setFormData(form))
    await act(async () => result.current.handleSubmit())
    expect(request).not.toHaveBeenCalled()
    expect(result.current.formData).toEqual(form)
    expect(notifications.error).toHaveBeenCalledWith(
      'Selecione uma locadora para enviar sua solicitação.'
    )
  })
  it('sends the selected slug once and describes queued delivery truthfully', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({
        success: true,
        data: { messageId: 'request-1', deliveryStatus: 'queued' },
      })
    const { result } = renderHook(useContactForm, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientProvider client={{ request }}>
          <PublicTenantProvider value="locadora-a">
            {children}
          </PublicTenantProvider>
        </ApiClientProvider>
      ),
    })
    act(() => result.current.setFormData(form))
    await act(async () => {
      await Promise.all([
        result.current.handleSubmit(),
        result.current.handleSubmit(),
      ])
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(JSON.parse(request.mock.calls[0]?.[1].body)).toEqual({
      ...form,
      tenantSlug: 'locadora-a',
    })
    expect(notifications.success).toHaveBeenCalledWith(
      'Solicitação recebida',
      expect.objectContaining({
        description:
          'A solicitação foi registrada; as notificações estão na fila de envio.',
      })
    )
    expect(result.current.formData.name).toBe('')
    expect(result.current.isSubmitting).toBe(false)
  })
})
