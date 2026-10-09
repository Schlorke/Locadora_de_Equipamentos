import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ImageCarouselZoom admin', () => {
  it('preserva next/image, Card e placeholder', () => {
    const source = readFileSync(
      new URL('./ImageCarouselZoom.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('next/image')
    expect(source).toContain('@gb-locacoes/ui')
    expect(source).toContain('placeholder.svg')
    expect(source).toContain('export function ImageCarouselZoom')
    expect(source).not.toContain('equipment-3d-carousel')
    expect(source).not.toContain('model-viewer')
  })
})
