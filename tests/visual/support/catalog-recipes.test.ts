import { describe, expect, it } from 'vitest'
import {
  assertFullCatalogCaptures,
  parseCatalogRecipeFilter,
} from './catalog-recipes.mjs'

const recipes = {
  Button: { states: ['default', 'disabled'] },
  Dialog: { states: ['closed'] },
}
const complete = (): Record<string, unknown> => ({
  base: {},
  'receita:Button/default': {},
  'receita:Button/disabled': {},
  'receita:Dialog/closed': {},
})

describe('visual catalog recipe filter', () => {
  it.each([undefined, '', ',', ',,,', ' ', ' , , '])(
    'treats missing or empty tokens as a full capture: %j',
    (value) => {
      expect(parseCatalogRecipeFilter(value)).toBeUndefined()
    }
  )

  it('retains explicit selected recipe names in order', () => {
    expect(parseCatalogRecipeFilter('Button, Dialog,,')).toEqual([
      'Button',
      'Dialog',
    ])
  })

  it('preserves the canonical case of a selector instead of broadening it', () => {
    expect(parseCatalogRecipeFilter('button')).toEqual(['button'])
  })
})

describe('full visual catalog inventory', () => {
  it('accepts exactly base plus every declared recipe state without changing inputs', () => {
    const captures = complete()
    const before = JSON.stringify({ captures, recipes })
    expect(() => assertFullCatalogCaptures(captures, recipes)).not.toThrow()
    expect(JSON.stringify({ captures, recipes })).toBe(before)
  })

  it('rejects the historical false positive consisting only of base', () => {
    expect(() => assertFullCatalogCaptures({ base: {} }, recipes)).toThrow(
      'expected 4'
    )
  })

  it.each(['base', 'receita:Button/disabled', 'receita:Dialog/closed'])(
    'rejects a missing declared capture: %s',
    (key) => {
      const captures = complete()
      Reflect.deleteProperty(captures, key)
      expect(() => assertFullCatalogCaptures(captures, recipes)).toThrow(
        'incomplete'
      )
    }
  )

  it('rejects an undeclared state even when the total count still matches', () => {
    const captures = complete()
    Reflect.deleteProperty(captures, 'receita:Button/disabled')
    captures['receita:Button/ghost'] = {}
    expect(() => assertFullCatalogCaptures(captures, recipes)).toThrow(
      'keys differ'
    )
  })

  it('rejects a surplus capture rather than accepting a stale merged result', () => {
    const captures = complete()
    captures['receita:Other/stale'] = {}
    expect(() => assertFullCatalogCaptures(captures, recipes)).toThrow(
      'incomplete'
    )
  })

  it('allows a base-only capture only when no recipe states are declared', () => {
    expect(() => assertFullCatalogCaptures({ base: {} }, {})).not.toThrow()
  })
})
