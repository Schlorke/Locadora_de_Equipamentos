// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AdvancedCalendar } from './AdvancedCalendar.native'
const classes = vi.hoisted(() => [] as string[])
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(classes)
)
vi.mock(
  '@gb-locacoes/ui',
  async () =>
    await (
      await import('../../../../../../tests/helpers/native-screen')
    ).nativeUi()
)
afterEach(() => {
  cleanup()
  classes.length = 0
})
it('recurso, evento, quatro visões e navegação têm callbacks reais', () => {
  const onEventClick = vi.fn(),
    onDateClick = vi.fn()
  const event = {
    id: 'item',
    title: 'Entrega Cliente',
    start: new Date(2024, 1, 15, 12),
    end: new Date(2024, 1, 15, 14),
    resourceId: 'van',
    color: '',
    type: 'delivery' as const,
    status: 'SCHEDULED',
  }
  render(
    <AdvancedCalendar
      events={[event]}
      resources={[{ id: 'van', name: 'Veículo Local' }]}
      defaultDate={new Date(2024, 1, 15)}
      onEventClick={onEventClick}
      onDateClick={onDateClick}
    />
  )
  expect(screen.getByText('Veículo Local')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Exibir evento item' }))
  expect(onEventClick).toHaveBeenCalledWith(event)
  fireEvent.click(screen.getByRole('button', { name: 'Diário' }))
  expect(screen.queryByRole('button', { name: '14/02/2024' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo período' }))
  expect(
    screen.queryByRole('button', { name: 'Exibir evento item' })
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mensal' }))
  expect(screen.getByRole('button', { name: '29/01/2024' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Linha do tempo' }))
  fireEvent.click(screen.getByRole('button', { name: '15/02/2024' }))
  expect(onDateClick).toHaveBeenCalledWith(new Date(2024, 1, 15))
  expect(classes).toEqual([])
})
