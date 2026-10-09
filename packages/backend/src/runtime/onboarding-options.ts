import { open } from 'node:fs/promises'
import path from 'node:path'
import { resolvePlatformEnv } from '@gb-locacoes/contracts/platform'
import {
  OnboardingError,
  readPublishedOnboardingOptions,
} from '../modules/onboarding/index'
import { createOnboardingOptionsHandler } from '../http/onboarding-options'
import {
  assertSelfServiceOnboardingConfiguration,
  readAssistedOnboardingConfiguration,
} from './onboarding'

/** Approved exact texts live outside the repository. No provider, database, pool or secret is returned. */
export async function readConfiguredOnboardingOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date()
) {
  if ((env.PLATFORM_SELF_SERVICE_SIGNUP ?? 'off') === 'off')
    return { mode: 'off' } as const
  assertSelfServiceOnboardingConfiguration(env)
  const filename = env.PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE
  if (!path.isAbsolute(filename ?? ''))
    throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
  let contents: unknown
  try {
    const file = await open(filename!, 'r')
    try {
      const info = await file.stat()
      if (!info.isFile() || info.size > 262144) throw new Error('INVALID_FILE')
      // Read at most the ceiling plus one byte, even if the file grows after stat.
      const bytes = Buffer.alloc(262145)
      let length = 0
      while (length < bytes.length) {
        const part = await file.read(bytes, length, bytes.length - length, null)
        if (part.bytesRead === 0) break
        length += part.bytesRead
      }
      if (length > 262144) throw new Error('INVALID_FILE')
      contents = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          bytes.subarray(0, length)
        )
      )
    } finally {
      await file.close()
    }
  } catch {
    throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
  }
  const configuration = await readAssistedOnboardingConfiguration(env)
  return readPublishedOnboardingOptions({
    publication: configuration.publication(),
    contents,
    today: now.toISOString().slice(0, 10),
    rootDomain: resolvePlatformEnv(env).rootDomain,
    captchaSiteKey: env.PLATFORM_CAPTCHA_SITE_KEY ?? '',
  })
}
export function handleConfiguredOnboardingOptions(request: Request) {
  return createOnboardingOptionsHandler({
    environment: () => process.env,
    read: () => readConfiguredOnboardingOptions(),
  })(request)
}
