import { describe, expect, it } from 'vitest'
import {
  OnboardingOptionsResponseSchema,
  REQUIRED_SIGNUP_DOCUMENTS,
} from './onboarding'
const documents = REQUIRED_SIGNUP_DOCUMENTS.map((kind) => ({
  kind,
  version: '2026-10-01',
  textSha256: 'a'.repeat(64),
  text: 'Synthetic text only',
}))
const options = {
  mode: 'on',
  rootDomain: 'example.invalid',
  captchaSiteKey: 'public-test',
  documents,
}
describe('strict onboarding options', () => {
  it('off contains only the mode', () => {
    expect(OnboardingOptionsResponseSchema.parse({ mode: 'off' })).toEqual({
      mode: 'off',
    })
    expect(
      OnboardingOptionsResponseSchema.safeParse({ ...options, mode: 'off' })
        .success
    ).toBe(false)
  })
  it('four exact documents and optional marketing', () => {
    expect(OnboardingOptionsResponseSchema.parse(options)).toEqual(options)
    expect(
      OnboardingOptionsResponseSchema.safeParse({
        ...options,
        documents: [
          ...documents,
          { ...documents[0], kind: 'MARKETING_OPT_IN' },
        ],
      }).success
    ).toBe(true)
  })
  it.each([
    { ...options, secret: 'never' },
    { ...options, documents: documents.slice(1) },
    { ...options, documents: [...documents, documents[0]] },
    { ...options, documents: documents.map((d) => ({ ...d, text: '' })) },
    {
      ...options,
      documents: documents.map((d) => ({ ...d, text: 'x'.repeat(32769) })),
    },
    {
      ...options,
      documents: documents.map((d) => ({
        ...d,
        url: 'https://example.invalid/terms',
      })),
    },
    { ...options, captchaSiteKey: '<script>' },
    { ...options, mode: 'ON' },
  ])('rejects extras, malformed or incomplete publication %#', (value) => {
    expect(OnboardingOptionsResponseSchema.safeParse(value).success).toBe(false)
  })
})
