// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, type HttpClient } from '../../../shared/api'
import { SettingsProvider, useSettings, useCompanyInfo } from './use-settings'
afterEach(cleanup)
describe('Settings provider HTTP adapter', () => {
  it('loads and refreshes only through the supplied transport', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { companyPhone: 'one' } })
      .mockResolvedValueOnce({ success: true, data: { companyPhone: 'two' } })
    const client: HttpClient = { request }
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApiClientProvider, {
        client,
        children: createElement(SettingsProvider, { children }),
      })
    const { result } = renderHook(
      () => ({ settings: useSettings(), company: useCompanyInfo() }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.settings.loading).toBe(false))
    expect(result.current.company.companyPhone).toBe('one')
    await act(async () => {
      await result.current.settings.refresh()
    })
    expect(result.current.company.companyPhone).toBe('two')
    expect(request).toHaveBeenCalledTimes(2)
    expect(
      request.mock.calls.every(
        (call) =>
          call[0].path === '/api/admin/settings' ||
          call[0] === '/api/admin/settings'
      )
    ).toBe(true)
  })
})

it('mantém dados durante refresh e limpa somente ao mudar o transporte', async () => {
  const first: HttpClient = {
    request: vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { companyPhone: 'one' } })
      .mockResolvedValueOnce({ success: false, error: 'offline' }),
  }
  const second: HttpClient = {
    request: vi.fn().mockResolvedValue({ success: false, error: 'offline' }),
  }
  let selected = first
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ApiClientProvider, {
      client: selected,
      children: createElement(SettingsProvider, { children }),
    })
  const hook = renderHook(useSettings, { wrapper })
  await waitFor(() =>
    expect(hook.result.current.settings?.companyPhone).toBe('one')
  )
  await act(async () => hook.result.current.refresh())
  expect(hook.result.current.settings?.companyPhone).toBe('one')
  selected = second
  hook.rerender()
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.settings).toBeNull()
})
