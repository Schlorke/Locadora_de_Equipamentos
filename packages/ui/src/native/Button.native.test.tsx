import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { themes } from '@gb-locacoes/design-tokens'

const recorded = vi.hoisted(() => ({
  calls: [] as Array<{ host: string; props: Record<string, unknown> }>,
}))

vi.mock('react-native', () => {
  const host = (name: string) =>
    function Host(props: Record<string, unknown> & { children?: ReactNode }) {
      const style =
        typeof props.style === 'function'
          ? (props.style as (s: { pressed: boolean }) => unknown)({
              pressed: false,
            })
          : props.style
      recorded.calls.push({ host: name, props: { ...props, style } })
      return createElement(`rn-${name.toLowerCase()}`, null, props.children)
    }
  return {
    Pressable: host('Pressable'),
    Text: host('Text'),
    ActivityIndicator: host('ActivityIndicator'),
    View: host('View'),
  }
})

const { ThemeProvider } = await import('../theme/ThemeProvider')
const { Button } = await import('./Button.native')

const styleOf = (host: string) =>
  recorded.calls.find((c) => c.host === host)?.props.style as
    Record<string, unknown> | undefined
// Set by tools/token-propagation-check.mjs, which points @gb-locacoes/design-tokens at a temporary
// copy whose primary color is this sentinel.
const expectedPrimary = process.env.EXPECT_PRIMARY?.toUpperCase()

describe('Button (native) style resolution', () => {
  beforeEach(() => {
    recorded.calls = []
  })

  it('uses the slate token for the default variant', () => {
    renderToStaticMarkup(
      createElement(
        ThemeProvider,
        null,
        createElement(Button, { children: 'Alugar' })
      )
    )
    const pressable = styleOf('Pressable')
    const text = styleOf('Text')
    expect(String(pressable?.backgroundColor).toUpperCase()).toBe(
      themes.light.secondary.toUpperCase()
    )
    expect(String(text?.color).toUpperCase()).toBe(
      themes.light.onSecondary.toUpperCase()
    )
  })

  it('resolves the gradient variant background from the primary token', () => {
    renderToStaticMarkup(
      createElement(
        ThemeProvider,
        null,
        createElement(Button, { children: 'Alugar', variant: 'gradient' })
      )
    )
    const background = String(
      styleOf('Pressable')?.backgroundColor
    ).toUpperCase()
    expect(background).toBe(themes.light.primary.toUpperCase())
    if (expectedPrimary) expect(background).toBe(expectedPrimary)
  })

  it('does not press when disabled', () => {
    renderToStaticMarkup(
      createElement(
        ThemeProvider,
        null,
        createElement(Button, { children: 'Alugar', disabled: true })
      )
    )
    const props = recorded.calls.find((c) => c.host === 'Pressable')?.props
    expect(props?.accessibilityState).toEqual({ disabled: true })
    expect(props?.disabled).toBe(true)
    expect(props?.onPress).toBeUndefined()
  })
  it('passes the explicit accessible label for an icon action, preserving the text fallback', () => {
    renderToStaticMarkup(
      createElement(Button, {
        children: '+',
        'aria-label': 'Aumentar quantidade',
      })
    )
    expect(
      recorded.calls.find((c) => c.host === 'Pressable')?.props
        .accessibilityLabel
    ).toBe('Aumentar quantidade')
    recorded.calls = []
    renderToStaticMarkup(createElement(Button, { children: 'Alugar' }))
    expect(
      recorded.calls.find((c) => c.host === 'Pressable')?.props
        .accessibilityLabel
    ).toBe('Alugar')
  })
})
