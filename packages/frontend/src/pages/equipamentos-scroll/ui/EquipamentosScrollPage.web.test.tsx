import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('EquipamentosScrollPage', () => {
  it('compõe EquipmentInfiniteScroll sem Prisma', () => {
    const source = readFileSync(
      new URL('./EquipamentosScrollPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('export function EquipamentosScrollPage')
    expect(source).toContain('EquipmentInfiniteScroll')
    expect(source).toContain("from '../../../widgets/home-cliente'")
    expect(source).toContain('min-h-screen bg-gray-50')
    expect(source).not.toContain('prisma')
    expect(source).not.toContain('@prisma')
  })
})
