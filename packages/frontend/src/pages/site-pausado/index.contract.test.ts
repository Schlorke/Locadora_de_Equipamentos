import { describe, expect, it } from 'vitest'
import * as slice from './index'
import { SitePausadoPage } from './ui/SitePausadoPage.web'

describe('contrato site-pausado', () => {
  it('exporta só SitePausadoPage pelo index público do slice', () => {
    expect(Object.keys(slice)).toEqual(['SitePausadoPage'])
    expect(slice.SitePausadoPage).toBe(SitePausadoPage)
  })
})
