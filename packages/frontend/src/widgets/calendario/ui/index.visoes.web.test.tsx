import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Calendário avançado', () => {
  it('expõe o contrato das quatro visões e sua montagem em Logística', () => {
    const types = readFileSync(new URL('./types.ts', import.meta.url), 'utf8')
    expect(types).toContain(
      "export type ViewMode = 'daily' | 'weekly' | 'monthly' | 'timeline'"
    )
    const index = readFileSync(
      new URL('./index.web.tsx', import.meta.url),
      'utf8'
    )
    expect(index).toContain('export function AdvancedCalendar')
    const publicApi = readFileSync(
      new URL('../index.ts', import.meta.url),
      'utf8'
    )
    expect(publicApi).toContain(
      'export type { CalendarEvent, CalendarResource, ViewMode }'
    )
    const page = readFileSync(
      new URL(
        '../../../pages/logistica/ui/LogisticaPage.web.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(page).toContain("from '../../../widgets/calendario'")
  })
})
