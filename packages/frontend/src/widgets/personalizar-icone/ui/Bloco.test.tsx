// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ICON_PICKER_TABS,
  buildIconGroups,
  buildEmojiGroups,
} from '../model/dados'
import { useEmojiRecents } from '../model/emoji-recents'
afterEach(() => {
  cleanup()
  localStorage.clear()
})
describe('Icon picker shared selection', () => {
  it('exposes all three sources and keeps recent selections searchable', () => {
    expect(ICON_PICKER_TABS.map((tab) => tab.value)).toEqual([
      'icons',
      'emoji',
      'custom',
    ])
    expect(
      buildEmojiGroups({ recentEmojis: ['😀'], searchTerm: '' }).groups.some(
        (group) => group.emojis.includes('😀')
      )
    ).toBe(true)
    expect(
      buildIconGroups({ recentIcons: ['Hammer'], searchTerm: '' }).groups.some(
        (group) => group.icons.includes('Hammer')
      )
    ).toBe(true)
  })
  it('persists the most recent distinct emojis with the existing limit', async () => {
    localStorage.setItem('gb-locacoes-emoji-recents', JSON.stringify(['😀']))
    const { result } = renderHook(() => useEmojiRecents())
    await waitFor(() => expect(result.current.recents).toEqual(['😀']))
    act(() => {
      for (let i = 0; i < 35; i++) result.current.addRecentEmoji('emoji-' + i)
    })
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem('gb-locacoes-emoji-recents')!)
      ).toHaveLength(30)
    )
    expect(result.current.recents[0]).toBe('emoji-34')
    act(() => result.current.clearRecentEmojis())
    await waitFor(() =>
      expect(localStorage.getItem('gb-locacoes-emoji-recents')).toBeNull()
    )
  })
})
