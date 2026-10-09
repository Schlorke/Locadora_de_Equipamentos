import { expect, it } from 'vitest'
import {
  isOwnerAccountSignUp,
  withOwnerAccountRegistration,
} from './owner-signup-context'
const data = {
  name: 'Ana',
  email: 'owner@example.test',
  password: 'long-fixture-password',
}
it('never grants the minimal flow without a server-owned context', () => {
  expect(isOwnerAccountSignUp(data)).toBe(false)
})
it('binds the scope to the exact parsed credentials and closes it after completion', async () => {
  await withOwnerAccountRegistration(data, async () => {
    await Promise.resolve()
    expect(isOwnerAccountSignUp(data)).toBe(true)
    expect(
      isOwnerAccountSignUp({ ...data, email: 'another@example.test' })
    ).toBe(false)
    expect(isOwnerAccountSignUp({ ...data, password: 'other-password' })).toBe(
      false
    )
  })
  expect(isOwnerAccountSignUp(data)).toBe(false)
})
it('does not transfer an owner scope to concurrent customer registrations', async () => {
  let release!: () => void
  const pause = new Promise<void>((resolve) => {
    release = resolve
  })
  const owner = withOwnerAccountRegistration(data, async () => {
    await pause
    expect(isOwnerAccountSignUp(data)).toBe(true)
  })
  expect(isOwnerAccountSignUp(data)).toBe(false)
  release()
  await owner
})
