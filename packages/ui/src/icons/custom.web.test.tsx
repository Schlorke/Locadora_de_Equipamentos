import { describe, expect, it } from 'vitest'
import {
  AndaimeSuspenso,
  CUSTOM_ICONS,
  CustomIcon1,
  type CustomIconName,
  type CustomIconProps,
} from './custom.web'

describe('custom icons', () => {
  it('preserva nomes exportados e CUSTOM_ICONS', () => {
    expect(CustomIcon1.displayName).toBe('CustomIcon1')
    expect(AndaimeSuspenso.displayName).toBe('AndaimeSuspenso')
    expect(CUSTOM_ICONS.AndaimeSuspenso).toBe(AndaimeSuspenso)
    expect(Object.keys(CUSTOM_ICONS)).toEqual(
      expect.arrayContaining([
        'CustomIcon1',
        'CustomIcon2',
        'AndaimeSuspenso',
        'AndaimeTubular',
        'Transporte',
        'Terraplenagem',
        'Rompedor',
        'Compressor',
        'CadeiraEletrica',
        'Betoneira',
        'TrabalhoEmAltura',
        'Lavagem',
      ])
    )
    const props: CustomIconProps = { size: 24, color: 'currentColor' }
    expect(props.size).toBe(24)
    const name: CustomIconName = 'Betoneira'
    expect(name in CUSTOM_ICONS).toBe(true)
  })
})
