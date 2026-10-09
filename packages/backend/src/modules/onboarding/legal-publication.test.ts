import { describe, expect, it } from 'vitest'
import {
  publishedSignupDocuments,
  assertPublishedAcceptances,
} from './legal-publication'
import { onboardingPublication } from '../../../../../tests/helpers/onboarding-data'

describe('trusted legal publication before onboarding', () => {
  it('accepts exactly the approved version and text hash', () => {
    const current = publishedSignupDocuments(
      onboardingPublication,
      '2026-10-04'
    )
    expect(current).toEqual(onboardingPublication)
    expect(() =>
      assertPublishedAcceptances(onboardingPublication, current)
    ).not.toThrow()
    for (const changes of [
      { textSha256: 'a'.repeat(64) },
      { version: '2026-09-30' },
    ])
      expect(() =>
        assertPublishedAcceptances(
          [{ ...onboardingPublication[0]!, ...changes }],
          current
        )
      ).toThrow('LEGAL_DOCUMENT_CHANGED')
  })
  it.each([
    undefined,
    [],
    onboardingPublication.slice(1),
    [...onboardingPublication, onboardingPublication[0]],
    onboardingPublication.map((row) => ({ ...row, version: '2026-10-05' })),
    onboardingPublication.map((row) => ({ ...row, approved: true })),
  ])(
    'refuses absent, duplicate, incomplete, future or client-added publication metadata: %#',
    (input) => {
      expect(() => publishedSignupDocuments(input, '2026-10-04')).toThrow(
        'LEGAL_PUBLICATION_UNAVAILABLE'
      )
    }
  )
})
