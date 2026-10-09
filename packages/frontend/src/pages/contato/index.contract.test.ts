import { describe, expect, it } from 'vitest'
import * as slice from './index'
import { ContatoPage } from './ui/ContatoPage'

describe('contrato contato', () => {
  it('exporta ContatoPage pelo index público do slice', () => {
    expect(Object.keys(slice)).toEqual(['ContatoPage'])
    expect(slice.ContatoPage).toBe(ContatoPage)
    expect(typeof slice.ContatoPage).toBe('function')
  })
})
