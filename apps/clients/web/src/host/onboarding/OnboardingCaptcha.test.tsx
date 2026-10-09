// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OnboardingCaptcha } from './OnboardingCaptcha'
afterEach(() => {
  cleanup()
  delete window.turnstile
})
it('binds onboarding action, expires tokens, removes only its widget and recreates manually', async () => {
  const renderWidget = vi
    .fn<NonNullable<Window['turnstile']>['render']>()
    .mockReturnValue('widget-owned')
  const remove = vi.fn()
  window.turnstile = { render: renderWidget, remove }
  const onToken = vi.fn()
  const tree = render(
    <OnboardingCaptcha siteKey="public-fixture" attempt={0} onToken={onToken} />
  )
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1))
  const options = renderWidget.mock.calls[0]![1]
  expect(options).toMatchObject({
    sitekey: 'public-fixture',
    action: 'onboarding',
    appearance: 'interaction-only',
  })
  options.callback('token-owned')
  expect(onToken).toHaveBeenLastCalledWith('token-owned')
  options['expired-callback']()
  expect(onToken).toHaveBeenLastCalledWith(null)
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Refazer verificação de segurança',
    })
  )
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2))
  expect(remove).toHaveBeenCalledWith('widget-owned')
  tree.rerender(
    <OnboardingCaptcha siteKey="public-fixture" attempt={1} onToken={onToken} />
  )
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(3))
  const count = onToken.mock.calls.length
  options.callback('stale')
  expect(onToken.mock.calls.length).toBe(count)
  tree.unmount()
  expect(remove).toHaveBeenCalledTimes(3)
})
