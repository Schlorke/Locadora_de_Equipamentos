// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminPermissionsPage } from './PermissoesPage'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('Admin permissions', () => {
  it('locks the admin matrix while allowing explicit operator edits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ permissions: [] }),
      })
    )
    render(
      <FrontendSessionFixture>
        <AdminPermissionsPage />
      </FrontendSessionFixture>
    )
    await screen.findByRole('heading', { name: 'Gerenciar Permissões' })
    expect(
      screen
        .getAllByRole('checkbox')
        .every((element) => (element as HTMLButtonElement).disabled)
    ).toBe(true)
    for (const label of ['Administrador', 'Operador', 'Financeiro', 'Cliente'])
      expect(
        screen.getByRole('button', { name: new RegExp(label) })
      ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Operador/ }))
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('checkbox')
          .every((element) => !(element as HTMLButtonElement).disabled)
      ).toBe(true)
    )
    const first = screen.getAllByRole('checkbox')[0]!
    fireEvent.click(first)
    expect(first.getAttribute('aria-checked')).toBe('true')
  })
})
