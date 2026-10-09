// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ApplicationSessionProvider,
  type SessionState,
} from '../../../entities/sessao'
import { useCartStore } from '../../../features/carrinho'
import { NavigationProvider } from '@gb-locacoes/ui'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
  info: vi.fn(),
  success: vi.fn(),
  navigate: vi.fn(),
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/AlertDialog.native')),
  ...(await import('../../../../../ui/src/native/Checkbox.native')),
  ...(await import('../../../../../ui/src/native/Select.native')),
  toast: captured,
}))
import { SmartEquipmentPricing } from './EquipamentoPreco.native'
import { SmartQuoteButton } from './EquipamentoOrcamento.native'
const props = {
  equipmentId: 'eq-1',
  equipmentName: 'Betoneira',
  pricePerDay: 100,
  isAvailable: true,
  weeklyUseDirectValue: true,
  weeklyDirectValue: 0,
}
function tree(
  child: React.ReactNode,
  status: SessionState['status'] = 'authenticated'
) {
  return (
    <NavigationProvider navigate={captured.navigate}>
      <ApplicationSessionProvider
        value={{
          data: status === 'authenticated' ? { user: { id: 'ana' } } : null,
          status,
          update: async () => null,
          signOut: async () => {},
        }}
      >
        {child}
      </ApplicationSessionProvider>
    </NavigationProvider>
  )
}
beforeEach(() => {
  captured.classes.length = 0
  captured.navigate.mockClear()
  captured.info.mockClear()
  captured.success.mockClear()
  window.localStorage.clear()
  useCartStore.setState({ items: [] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('conserva valor direto zero e pede confirmação antes de adicionar sete dias', () => {
  render(tree(<SmartEquipmentPricing {...props} />))
  fireEvent.click(screen.getByRole('button', { name: 'Semanal' }))
  expect(screen.getAllByText(/R\$\s*0,00/).length).toBeGreaterThan(0)
  fireEvent.click(
    screen.getByRole('button', { name: 'Solicitar Orçamento Grátis' })
  )
  expect(useCartStore.getState().items).toHaveLength(0)
  fireEvent.click(
    screen.getByRole('button', { name: 'Não, apenas dias úteis' })
  )
  expect(useCartStore.getState().items[0]).toMatchObject({
    days: 7,
    finalPrice: 0,
    includeWeekends: false,
    includeWeekendsConfirmed: true,
    weeklyUseDirectValue: true,
    weeklyDirectValue: 0,
  })
  expect(captured.navigate).toHaveBeenCalledWith('/orcamento')
  expect(captured.classes).toEqual([])
})

it('espera loading resolver e visitante conserva retorno para o mesmo equipamento', async () => {
  const button = (
    <SmartQuoteButton
      {...props}
      selectedPeriod={{
        id: 'daily',
        label: 'Diário',
        period: 'dia',
        multiplier: 1,
        discount: 0,
      }}
      finalPrice={100}
    />
  )
  const r = render(tree(button, 'loading'))
  fireEvent.click(
    screen.getByRole('button', { name: 'Solicitar Orçamento Grátis' })
  )
  expect(captured.navigate).not.toHaveBeenCalled()
  await act(async () => {
    r.rerender(tree(button, 'unauthenticated'))
  })
  expect(captured.navigate).toHaveBeenCalledWith(
    '/login?callbackUrl=%2Fequipamentos%2Feq-1'
  )
  expect(useCartStore.getState().items).toEqual([])
})

it('datas contam dias úteis, bloqueiam períodos manuais e mantêm datas no carrinho', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 1, 12))
  render(
    tree(
      <SmartEquipmentPricing
        {...props}
        weeklyUseDirectValue={false}
        monthlyRentalEnabled={false}
      />
    )
  )
  expect(
    (screen.getByRole('button', { name: 'Mensal' }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  fireEvent.click(
    screen.getByRole('button', { name: 'Selecione as datas de início e fim' })
  )
  expect(
    (screen.getByRole('button', { name: '03/10/2026' }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '02/10/2026' }))
  expect(screen.getByRole('button', { name: '05/10/2026' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '05/10/2026' }))
  expect(screen.getByText('Preço por 2 dias')).toBeTruthy()
  expect(
    (screen.getByRole('button', { name: 'Semanal' }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  fireEvent.click(
    screen.getByRole('button', { name: 'Solicitar Orçamento Grátis' })
  )
  expect(useCartStore.getState().items[0]).toMatchObject({
    days: 2,
    includeWeekends: false,
    startDate: new Date(2026, 9, 2),
    endDate: new Date(2026, 9, 5),
  })
  expect(captured.navigate).toHaveBeenCalledWith('/orcamento')
})

it('incluir fins de semana recalcula o mesmo período, sem nova regra de preço', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 1, 12))
  render(
    tree(<SmartEquipmentPricing {...props} weeklyUseDirectValue={false} />)
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Selecione as datas de início e fim' })
  )
  fireEvent.click(screen.getByRole('button', { name: '02/10/2026' }))
  fireEvent.click(screen.getByRole('button', { name: '05/10/2026' }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Incluir finais de semana' })
  )
  expect(screen.getByText('Preço por 4 dias')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Limpar datas' }))
  expect(
    screen.getByRole('button', { name: 'Selecione as datas de início e fim' })
  ).toBeTruthy()
  expect(
    (screen.getByRole('button', { name: 'Semanal' }) as HTMLButtonElement)
      .disabled
  ).toBe(false)
})
