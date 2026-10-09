import { describe, expect, it } from 'vitest'
import * as slice from './index'
import { CookiesPage } from './ui/CookiesPage'

describe('contrato cookies', () => {
  it('exporta CookiesPage pelo index público do slice', () => {
    expect(Object.keys(slice)).toEqual(['CookiesPage'])
    expect(slice.CookiesPage).toBe(CookiesPage)
    expect(typeof slice.CookiesPage).toBe('function')
  })
})
