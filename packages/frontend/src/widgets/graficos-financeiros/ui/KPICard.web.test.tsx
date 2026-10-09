// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FinancialKPICard } from './KPICard.web'

// Recharts receives the component's real data and color choices. Its drawing
// engine is inert here; browser captures remain the proof of layout/animation.
const charts = vi.hoisted(() => ({
  line: vi.fn(),
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
    LineChart: (props: { children: ReactNode; data: unknown[] }) => {
      charts.data(props)
      return <svg aria-label="Histórico do indicador">{props.children}</svg>
    },
    Line: (props: { stroke: string; strokeWidth: number; dataKey: string }) => {
      charts.line(props)
      return (
        <path
          data-testid="kpi-line"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
      )
    },
    Tooltip: () => null,
    YAxis: () => null,
  }
})

const observers: OwnedResizeObserver[] = []

class OwnedResizeObserver implements ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(
    private readonly callback: ConstructorParameters<typeof ResizeObserver>[0]
  ) {
    observers.push(this)
  }

  resize() {
    this.callback([], this)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  observers.length = 0
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 100, 40)
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

describe('KPI financeiro', () => {
  it.each([
    {
      trend: 12.34,
      percentage: '12.3%',
      direction: 'up',
      color: '#22c55e',
      textColor: 'text-green-600',
    },
    {
      trend: 0,
      percentage: '0.0%',
      direction: 'up',
      color: '#22c55e',
      textColor: 'text-green-600',
    },
    {
      trend: -5.5,
      percentage: '5.5%',
      direction: 'down',
      color: '#ef4444',
      textColor: 'text-red-600',
    },
  ])(
    'renderiza tendência $trend com valor, direção e cor corretos',
    ({ trend, percentage, direction, color, textColor }) => {
      render(
        <FinancialKPICard
          title="Receita mensal"
          value={1234.567}
          trend={trend}
          trendLabel="em relação ao mês anterior"
          sparklineData={[10, 20, 15]}
        />
      )

      expect(screen.getByText('Receita mensal')).toBeTruthy()
      expect(screen.getByText('1.234,57')).toBeTruthy()
      const change = screen.getByText(
        `${percentage} em relação ao mês anterior`
      )
      expect(change.parentElement?.classList.contains(textColor)).toBe(true)
      expect(
        change.parentElement?.querySelector(`svg.lucide-arrow-${direction}`)
      ).not.toBeNull()
      expect(charts.line).not.toHaveBeenCalled()

      // Initial measurement (10 ms) then the actual stabilization window (50 ms).
      act(() => {
        vi.advanceTimersByTime(10)
      })
      act(() => {
        vi.advanceTimersByTime(49)
      })
      expect(charts.line).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(charts.dimensions).toHaveBeenLastCalledWith(
        expect.objectContaining({ width: 100, height: 40 })
      )
      expect(charts.data).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: [
            { value: 10, index: 0 },
            { value: 20, index: 1 },
            { value: 15, index: 2 },
          ],
        })
      )
      expect(charts.line).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dataKey: 'value',
          stroke: color,
          strokeWidth: 2,
        })
      )
      expect(screen.getByTestId('kpi-line').getAttribute('stroke')).toBe(color)
    }
  )

  it('preserva o valor textual e não monta sparkline sem dados', () => {
    render(
      <FinancialKPICard
        title="Utilização da frota"
        value="87%"
        trend={0}
        trendLabel="no período"
      />
    )
    expect(screen.getByText('87%')).toBeTruthy()
    expect(screen.getByText('0.0% no período')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(charts.line).not.toHaveBeenCalled()
    expect(charts.dimensions).not.toHaveBeenCalled()
    expect(observers).toHaveLength(0)
  })

  it('não entrega dimensões inválidas ao gráfico', () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, 0, 0, 0)
    )
    render(
      <FinancialKPICard
        title="Receita"
        value={0}
        trend={1}
        trendLabel="no período"
        sparklineData={[0, 0]}
      />
    )
    expect(screen.getByText('0,00')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(charts.line).not.toHaveBeenCalled()
    expect(charts.dimensions).not.toHaveBeenCalled()
  })

  it('cancela o frame de resize e a estabilização ao desmontar', () => {
    const view = render(
      <FinancialKPICard
        title="Receita"
        value={10}
        trend={1}
        trendLabel="no período"
        sparklineData={[10, 11]}
      />
    )
    act(() => {
      vi.advanceTimersByTime(10)
    })
    expect(observers).toHaveLength(1)
    act(() => {
      observers[0].resize()
    })
    view.unmount()
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(charts.line).not.toHaveBeenCalled()
  })
})
