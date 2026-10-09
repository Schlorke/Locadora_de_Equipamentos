import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { onboardingPublication } from '../../../../../tests/helpers/onboarding-data'
import { readPublishedOnboardingOptions } from './options'
const contents = Object.fromEntries(
  onboardingPublication.map((row) => [
    row.kind,
    'Synthetic test only:' + row.kind,
  ])
)
const input = {
  publication: onboardingPublication,
  contents,
  today: '2026-10-04',
  rootDomain: 'example.invalid',
  captchaSiteKey: 'public-test',
}
describe('trusted exact legal texts', () => {
  it('preserves text byte-for-byte with the approved hash and no private configuration', () => {
    const result = readPublishedOnboardingOptions(input)
    expect(result).toEqual({
      mode: 'on',
      rootDomain: input.rootDomain,
      captchaSiteKey: input.captchaSiteKey,
      documents: onboardingPublication.map((row) => ({
        ...row,
        text: contents[row.kind],
      })),
    })
  })
  it('marketing is separate and never manufactured or implied', () => {
    const text = 'Synthetic opt in only'
    const publication = [
      ...onboardingPublication,
      {
        kind: 'MARKETING_OPT_IN' as const,
        version: '2026-10-01',
        textSha256: createHash('sha256').update(text).digest('hex'),
      },
    ]
    expect(
      readPublishedOnboardingOptions({
        ...input,
        publication,
        contents: { ...contents, MARKETING_OPT_IN: text },
      })
    ).toMatchObject({
      documents: [
        ...onboardingPublication.map((row) => ({
          ...row,
          text: contents[row.kind],
        })),
        { kind: 'MARKETING_OPT_IN', text },
      ],
    })
  })
  it.each([
    undefined,
    {},
    { ...contents, PLATFORM_TERMS: 'different text' },
    { ...contents, PLATFORM_TERMS: contents.PLATFORM_TERMS + '\n' },
    { ...contents, MARKETING_OPT_IN: 'not in the approved publication' },
    { ...contents, SECRET: 'never returned' },
    Object.fromEntries(Object.entries(contents).slice(1)),
    { ...contents, PLATFORM_TERMS: 'x'.repeat(32769) },
  ])(
    'missing, changed, normalized or surplus text fails closed %#',
    (value) => {
      expect(() =>
        readPublishedOnboardingOptions({ ...input, contents: value })
      ).toThrow('LEGAL_PUBLICATION_UNAVAILABLE')
    }
  )
  it('future publication fails; HTML is returned literally, never rewritten or executed', () => {
    expect(() =>
      readPublishedOnboardingOptions({ ...input, today: '2026-09-30' })
    ).toThrow('LEGAL_PUBLICATION_UNAVAILABLE')
    const text = '<script>synthetic()</script>\r\nExact UTF-8: ação'
    const publication = onboardingPublication.map((row) =>
      row.kind === 'PLATFORM_TERMS'
        ? {
            ...row,
            textSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
          }
        : row
    )
    const result = readPublishedOnboardingOptions({
      ...input,
      publication,
      contents: { ...contents, PLATFORM_TERMS: text },
    })
    expect(result.mode === 'on' && result.documents[0]?.text).toBe(text)
  })
})
