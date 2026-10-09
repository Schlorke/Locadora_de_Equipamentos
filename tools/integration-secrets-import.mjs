import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'

const invalid = () => {
  throw new Error('SECRET_IMPORT_ARGUMENTS_INVALID')
}
const errorCodes = new Set([
  'SECRET_IMPORT_ARGUMENTS_INVALID',
  'SECRET_IMPORT_CONFIGURATION_INVALID',
  'SECRET_IMPORT_INPUT_INVALID',
  'SECRET_IMPORT_INTEGRATION_UNAVAILABLE',
  'SECRET_IMPORT_PROVIDER_UNSUPPORTED',
  'SECRET_IMPORT_REFERENCE_MISMATCH',
  'SECRET_IMPORT_ENVIRONMENT_MISMATCH',
  'SECRET_IMPORT_VARIABLE_MISSING',
  'SECRET_IMPORT_EXISTING_SECRET_CONFLICT',
  'SECRET_IMPORT_CONFIRMATION_INVALID',
  'SECRET_IMPORT_PLAN_CHANGED',
  'SECRET_IMPORT_FINGERPRINT_MISMATCH',
  'SECRET_IMPORT_UNAVAILABLE',
])
export function parseImportArguments(args) {
  const result = { apply: false }
  for (const argument of args) {
    if (argument === '--apply') {
      if (result.apply) invalid()
      result.apply = true
    } else {
      const match = /^--(integration|reference|env-file|confirm)=(.+)$/.exec(
        argument
      )
      if (!match || result[match[1]] !== undefined) invalid()
      result[match[1]] = match[2]
    }
  }
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(result.integration ?? '') ||
    !/^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$/.test(result.reference ?? '') ||
    !path.isAbsolute(result['env-file'] ?? '') ||
    result.apply !== (result.confirm !== undefined) ||
    (result.confirm !== undefined && !/^[a-f0-9]{64}$/.test(result.confirm))
  )
    invalid()
  return result
}

export async function runSecretImportCli(args, env, write, run) {
  try {
    const options = parseImportArguments(args)
    // Explicit local input only, with no expansion, evaluation or dotenv side effects.
    const stat = fs.statSync(options['env-file'])
    if (!stat.isFile() || stat.size > 262144) invalid()
    const variables = parseEnv(fs.readFileSync(options['env-file'], 'utf8'))
    const execute =
      run ??
      (await import('@gb-locacoes/backend/runtime')).runIntegrationSecretsImport
    const result = await execute(
      {
        integrationId: options.integration,
        reference: options.reference,
        variables,
      },
      options.apply ? options.confirm : undefined,
      env
    )
    write(JSON.stringify(result))
    return 0
  } catch (error) {
    const code =
      typeof error?.message === 'string' && errorCodes.has(error.message)
        ? error.message
        : 'SECRET_IMPORT_UNAVAILABLE'
    write(JSON.stringify({ error: code }))
    return 1
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]))
) {
  process.exitCode = await runSecretImportCli(
    process.argv.slice(2),
    process.env,
    (line) => process.stdout.write(line + '\n')
  )
}
