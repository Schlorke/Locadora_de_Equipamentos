import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { onboardingPublication } from '../../../../tests/helpers/onboarding-data'
import { readConfiguredOnboardingOptions } from './onboarding-options'
const owned: Array<{ dir: string; files: string[] }> = []
afterEach(async () => {
  for (const entry of owned.splice(0)) {
    for (const file of entry.files) await unlink(file).catch(() => {})
    await rmdir(entry.dir)
  }
})
async function fixture() {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), 'locadora-onboarding-options-')
  )
  const publication = path.join(dir, 'publication.json'),
    contents = path.join(dir, 'contents.json')
  owned.push({ dir, files: [publication, contents] })
  await writeFile(publication, JSON.stringify(onboardingPublication))
  await writeFile(
    contents,
    JSON.stringify(
      Object.fromEntries(
        onboardingPublication.map((row) => [
          row.kind,
          'Synthetic test only:' + row.kind,
        ])
      )
    )
  )
  return {
    publication,
    contents,
    env: {
      PLATFORM_ENV: 'development',
      PLATFORM_ROOT_DOMAIN: 'example.invalid',
      PLATFORM_SELF_SERVICE_SIGNUP: 'on',
      AUTH_MODE: 'better-auth',
      PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
      PLATFORM_SECRETS_KMS_KEY_ARN: 'synthetic-key',
      AWS_ROLE_ARN: 'synthetic-role',
      AWS_WEB_IDENTITY_TOKEN_FILE: path.join(dir, 'never-read-identity'),
      PLATFORM_CAPTCHA_SECRET_KEY: 'synthetic-secret',
      PLATFORM_CAPTCHA_SITE_KEY: 'public-test',
      PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
      PLATFORM_LEGAL_DOCUMENTS_FILE: publication,
      PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE: contents,
    },
  }
}
describe('configured onboarding options without services or pools', () => {
  it('off never reads publication, texts, identity file, provider or secret', async () => {
    expect(
      await readConfiguredOnboardingOptions({
        PLATFORM_SELF_SERVICE_SIGNUP: 'off',
        PLATFORM_LEGAL_DOCUMENTS_FILE: 'missing',
        PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE: 'missing',
        PLATFORM_CAPTCHA_SECRET_KEY: 'never returned',
      })
    ).toEqual({ mode: 'off' })
    expect(await readConfiguredOnboardingOptions({})).toEqual({ mode: 'off' })
  })
  it('actual external texts match the operator publication and only public values are returned', async () => {
    const { env } = await fixture()
    const result = await readConfiguredOnboardingOptions(
      env,
      new Date('2026-10-04T12:00:00Z')
    )
    expect(result).toMatchObject({
      mode: 'on',
      rootDomain: 'example.invalid',
      captchaSiteKey: 'public-test',
    })
    expect(JSON.stringify(result)).not.toContain('synthetic-secret')
    expect(JSON.stringify(result)).not.toContain('synthetic-key')
    expect(JSON.stringify(result)).not.toContain('never-read-identity')
  })
  it.each([
    'AUTH_MODE',
    'PLATFORM_SECRETS_KMS_KEY_ARN',
    'AWS_ROLE_ARN',
    'AWS_WEB_IDENTITY_TOKEN_FILE',
    'PLATFORM_CAPTCHA_SECRET_KEY',
    'PLATFORM_CAPTCHA_SITE_KEY',
  ])('on with missing %s fails before any publication', async (field) => {
    const { env } = await fixture()
    await expect(
      readConfiguredOnboardingOptions({ ...env, [field]: undefined })
    ).rejects.toThrow('ONBOARDING_CONFIGURATION_INVALID')
  })
  it.each([undefined, 'relative.json'])(
    'contents need an absolute operator-owned path: %j',
    async (filename) => {
      const { env } = await fixture()
      await expect(
        readConfiguredOnboardingOptions({
          ...env,
          PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE: filename,
        })
      ).rejects.toThrow('LEGAL_PUBLICATION_UNAVAILABLE')
    }
  )
  it.each([
    Buffer.from('not JSON'),
    Buffer.from([0xc3, 0x28]),
    Buffer.alloc(262145, 0x20),
    Buffer.from(JSON.stringify({ PLATFORM_TERMS: 'unapproved' })),
  ])(
    'malformed, invalid UTF8, oversize or unapproved file is not exposed %#',
    async (bytes) => {
      const { env, contents } = await fixture()
      await writeFile(contents, bytes)
      await expect(
        readConfiguredOnboardingOptions(env, new Date('2026-10-04T12:00:00Z'))
      ).rejects.toThrow('LEGAL_PUBLICATION_UNAVAILABLE')
    }
  )
  it('missing file and directory fail without path leakage', async () => {
    const { env, contents } = await fixture()
    await unlink(contents)
    await expect(readConfiguredOnboardingOptions(env)).rejects.toThrow(
      'LEGAL_PUBLICATION_UNAVAILABLE'
    )
    await expect(
      readConfiguredOnboardingOptions({
        ...env,
        PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE: path.dirname(contents),
      })
    ).rejects.toThrow('LEGAL_PUBLICATION_UNAVAILABLE')
  })
})
