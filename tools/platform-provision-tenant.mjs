import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  CreateOrganizationInputSchema,
  IdempotencyKeySchema,
} from '@gb-locacoes/contracts/onboarding'

const invalid = () => {
  throw new Error('ONBOARDING_ARGUMENTS_INVALID')
}
const errorCodes = new Set([
  'ONBOARDING_ARGUMENTS_INVALID',
  'ONBOARDING_CONFIGURATION_INVALID',
  'ONBOARDING_RECEIPT_UNAVAILABLE',
  'ONBOARDING_INPUT_INVALID',
  'ONBOARDING_RATE_LIMITED',
  'LEGAL_DOCUMENT_CHANGED',
  'LEGAL_PUBLICATION_UNAVAILABLE',
  'INVALID_CNPJ',
  'EMAIL_NOT_VERIFIED',
  'EMAIL_NOT_ALLOWED',
  'AUTHENTICATION_REQUIRED',
  'PLATFORM_ADMIN_REQUIRED',
  'PLATFORM_STAFF_CANNOT_OWN_TENANT',
  'ORGANIZATION_LIMIT_REACHED',
  'PLAN_NOT_AVAILABLE',
  'SLUG_UNAVAILABLE',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_IDEMPOTENCY_KEY',
  'IDENTITY_CHANGED',
])
export function parseProvisionArguments(args) {
  const options = { apply: false }
  for (const arg of args) {
    if (arg === '--apply') {
      if (options.apply) invalid()
      options.apply = true
    } else {
      const match = /^--(input-file|owner|operator|key)=(.+)$/.exec(arg)
      if (!match || options[match[1]] !== undefined) invalid()
      options[match[1]] = match[2]
    }
  }
  if (
    !path.isAbsolute(options['input-file'] ?? '') ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(options.owner ?? '') ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(options.operator ?? '') ||
    !IdempotencyKeySchema.safeParse(options.key).success
  )
    invalid()
  return options
}

/** Default is a local payload preview. Only --apply opens the isolated runtime. */
export async function runProvisionCli(args, env, write, execute) {
  try {
    const options = parseProvisionArguments(args)
    const file = await fs.stat(options['input-file'])
    if (!file.isFile() || file.size > 16384) invalid()
    const text = await fs.readFile(options['input-file'], 'utf8')
    if (Buffer.byteLength(text, 'utf8') > 16384) invalid()
    const input = CreateOrganizationInputSchema.safeParse(JSON.parse(text))
    if (!input.success) invalid()
    if (!options.apply) {
      write(
        JSON.stringify({
          applied: false,
          scope: 'payload-only',
          ownerId: options.owner,
          slug: input.data.slug,
          planVersionId: input.data.planVersionId,
        })
      )
      return 0
    }
    const run =
      execute ??
      (await import('@gb-locacoes/backend/runtime'))
        .runAssistedOrganizationProvisioning
    const result = await run(
      { userId: options.owner, staffUserId: options.operator },
      input.data,
      options.key,
      env
    )
    write(JSON.stringify(result))
    return 0
  } catch (error) {
    const code =
      typeof error?.message === 'string' && errorCodes.has(error.message)
        ? error.message
        : 'ONBOARDING_UNAVAILABLE'
    write(JSON.stringify({ error: code }))
    return 1
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]))
) {
  process.exitCode = await runProvisionCli(
    process.argv.slice(2),
    process.env,
    (line) => process.stdout.write(line + '\n')
  )
}
