// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RevenueChart } from './RevenueChart.web'

// Keep the real ChartContainer/configuration and the real gradient elements.
// Only Recharts drawing is replaced; this does not prove browser geometry/GPU.
const charts = vi.hoisted(() => ({
  area: vi.fn(),
  data: vi.fn(),
  dimensions: vi.fn(),
}))

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: (props: {
      children: ReactNode
      width: number
      height: number
    }) => {
      charts.dimensions(props)
      return <div>{props.children}</div>
    },
    AreaChart: (props: { children: ReactNode; data: unknown[] }) => {
      charts.data(props)
      return <svg aria-label="Receita mensal">{props.children}</svg>
    },
    Area: (props: {
      stroke: string
      strokeWidth: number
      fill: string
      dataKey: string
    }) => {
      charts.area(props)
      return (
        <path
          data-testid="revenue-area"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          fill={props.fill}
        />
      )
    },
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  }
})

const observers: OwnedResizeObserver[] = []

class OwnedResizeObserver implements ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor() {
    observers.push(this)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  observers.length = 0
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 100, 320)
  )
  vi.stubGlobal('ResizeObserver', OwnedResizeObserver)
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
    window.setTimeout(() => callback(performance.now()), 16)
  )
  vi.stubGlobal('cancelAnimationFrame', (frame: number) =>
    window.clearTimeout(frame)
  )
})

afterEach(() => {
  try {
    cleanup()
    for (const observer of observers) {
      expect(observer.disconnect).toHaveBeenCalledTimes(1)
    }
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

describe('Receita mensal', () => {
  it.each([false, true])(
    'mostra a ausência de dados (expanded=%s)',
    (expanded) => {
      render(<RevenueChart data={[]} expanded={expanded} />)
      expect(screen.getByText('Sem dados disponíveis')).toBeTruthy()
      expect(screen.queryByLabelText('Receita mensal')).toBeNull()
      expect(charts.data).not.toHaveBeenCalled()
      expect(charts.area).not.toHaveBeenCalled()
      expect(observers).toHaveLength(0)
    }
  )

  it.each([false, true])(
    'entrega dados e cores preservados ao gráfico (expanded=%s)',
    (expanded) => {
      const data = [
        { month: 'Jan', revenue: 1234.5 },
        { month: 'Fev', revenue: 0 },
      ]
      const { container } = render(
        <RevenueChart data={data} expanded={expanded} />
      )
      expect(screen.queryByText('Sem dados disponíveis')).toBeNull()
      expect(charts.area).not.toHaveBeenCalled()

      // This is emitted CSS from the real config passed to ChartContainer.
      const chart = container.querySelector('[data-chart]')
      expect(chart).not.toBeNull()
      expect(chart?.querySelector('style')?.textContent).toContain(
        '--color-revenue: #ea580c;'
      )
      expect(
        chart?.classList.contains(expanded ? 'h-[320px]' : 'h-[280px]')
      ).toBe(true)

      act(() => {
        vi.advanceTimersByTime(10)
      })
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(charts.dimensions).toHaveBeenLastCalledWith(
        expect.objectContaining({ width: 100, height: 320 })
      )
      expect(charts.data).toHaveBeenLastCalledWith(
        expect.objectContaining({ data })
      )
      expect(charts.area).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dataKey: 'revenue',
          type: 'monotone',
          stroke: '#ea580c',
          strokeWidth: 2,
          fill: 'url(#colorRevenue)',
        })
      )
      const area = screen.getByTestId('revenue-area')
      expect(area.getAttribute('stroke')).toBe('#ea580c')
      expect(area.getAttribute('fill')).toBe('url(#colorRevenue)')

      const gradient = container.querySelector('linearGradient#colorRevenue')
      expect(gradient).not.toBeNull()
      expect(gradient?.getAttribute('x1')).toBe('0')
      expect(gradient?.getAttribute('y1')).toBe('0')
      expect(gradient?.getAttribute('x2')).toBe('0')
      expect(gradient?.getAttribute('y2')).toBe('1')
      const stops = container.querySelectorAll(
        'linearGradient#colorRevenue stop'
      )
      expect(stops).toHaveLength(2)
      expect(stops[0].getAttribute('offset')).toBe('5%')
      expect(stops[0].getAttribute('stop-color')).toBe('#ea580c')
      expect(stops[0].getAttribute('stop-opacity')).toBe('0.8')
      expect(stops[1].getAttribute('offset')).toBe('95%')
      expect(stops[1].getAttribute('stop-color')).toBe('#f97316')
      expect(stops[1].getAttribute('stop-opacity')).toBe('0.1')
    }
  )
})
