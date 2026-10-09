import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('GanttView e LogisticsCalendar', () => {
  it('GanttView preserva modos, status e importa seletor-data', () => {
    const source = readFileSync(
      new URL('./GanttView.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Diário')
    expect(source).toContain('Semanal')
    expect(source).toContain('Mensal')
    expect(source).toContain('Hoje')
    expect(source).toContain('SCHEDULED')
    expect(source).toContain('DELIVERY')
    expect(source).toContain('PICKUP')
    expect(source).toContain("from '../../../widgets/seletor-data'")
    expect(source).not.toContain('equipamento-detalhe')
    expect(source).not.toContain('components/admin/gantt-view')
  })

  it('LogisticsCalendar preserva agenda e rótulos de entrega', () => {
    const source = readFileSync(
      new URL('./LogisticsCalendar.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Agenda de Entregas e Coletas')
    expect(source).toContain('Agendada')
    expect(source).toContain('Em Trânsito')
    expect(source).toContain('Concluída')
    expect(source).toContain('Entrega')
    expect(source).toContain('Coleta')
    expect(source).toContain("from '../../../widgets/seletor-data'")
    expect(source).not.toContain('components/admin/logistics-calendar')
  })

  it('index exporta GanttView e LogisticsCalendar', () => {
    const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
    expect(index).toMatch(
      /export \{ GanttView \} from ['"]\.\/ui\/GanttView\.web['"]/
    )
    expect(index).toMatch(
      /export \{ LogisticsCalendar \} from ['"]\.\/ui\/LogisticsCalendar\.web['"]/
    )
  })
})
