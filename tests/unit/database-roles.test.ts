import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Client, Pool } from 'pg'
import { describe, expect, it } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { alterSharedAcl } from '../helpers/shared-acl'

/**
 * LOGIN roles in database tests (review finding 22). The CI service (postgres:18 with POSTGRES_PASSWORD)
 * authenticates TCP clients with scram-sha-256: a role created without a password, or a URL with the
 * password blanked, fails with "SASL: ... client password must be a string" and the isolation suites never
 * run there. The local cluster in trust mode hides it, so the test sources themselves are checked.
 */
const TESTS = path.join(process.cwd(), 'tests')
const SELF = path.join(TESTS, 'unit', 'database-roles.test.ts')
const SOURCE = /\.(?:[cm]?[jt]sx?)$/
const ROLE_WITH_LOGIN = /\b(?:CREATE|ALTER)\s+(?:ROLE|USER)\b.*\bLOGIN\b/i
const BLANK_PASSWORD = /\.password\s*=\s*(['"`])\1/

function sources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory())
      return entry.name === 'node_modules' || entry.name.startsWith('.')
        ? []
        : sources(full)
    return entry.isFile() && SOURCE.test(entry.name) ? [full] : []
  })
}

/** Lines that create a LOGIN role without a password or blank the password of a connection URL. */
function passwordlessLogins(
  files: ReadonlyArray<{ name: string; text: string }>
): string[] {
  const found: string[] = []
  for (const { name, text } of files)
    text.split(/\r?\n/).forEach((line, index) => {
      if (ROLE_WITH_LOGIN.test(line) && !/\bPASSWORD\b/i.test(line))
        found.push(
          `${name}:${index + 1}: LOGIN role without PASSWORD (use createLoginRole)`
        )
      if (BLANK_PASSWORD.test(line))
        found.push(
          `${name}:${index + 1}: connection URL with a blank password (use the URL from createLoginRole)`
        )
    })
  return found
}

describe('LOGIN roles of database tests carry a password', () => {
  it('no test creates a LOGIN role without a password or connects with a blank one', () => {
    const files = sources(TESTS)
      .filter((file) => file !== SELF)
      .map((file) => ({
        name: path.relative(process.cwd(), file).split(path.sep).join('/'),
        text: fs.readFileSync(file, 'utf8'),
      }))
    expect(files.length).toBeGreaterThan(50)
    expect(passwordlessLogins(files)).toEqual([])
  })

  it('flags the forms that failed in CI and accepts createLoginRole', () => {
    const text = [
      `await admin.query('CREATE ROLE "' + runtimeRole + '" LOGIN NOSUPERUSER NOBYPASSRLS')`,
      'await admin.query(`CREATE ROLE "${readerRole}" LOGIN NOSUPERUSER`)',
      "runtimeUrl.password = ''",
      'await admin.query(`CREATE ROLE "${outsider}" NOLOGIN NOSUPERUSER`)',
      "`CREATE ROLE ${quoteIdentifier(role)} LOGIN PASSWORD '${password}' ${attributes}`",
    ].join('\n')
    expect(passwordlessLogins([{ name: 'fixture.ts', text }])).toEqual([
      'fixture.ts:1: LOGIN role without PASSWORD (use createLoginRole)',
      'fixture.ts:2: LOGIN role without PASSWORD (use createLoginRole)',
      'fixture.ts:3: connection URL with a blank password (use the URL from createLoginRole)',
    ])
  })

  it.skipIf(!process.env.TEST_DATABASE_URL)(
    'createLoginRole stores a SCRAM verifier and returns a URL that logs in with it',
    async () => {
      const connectionString = requireTestDatabase(process.env)
      const admin = new Pool({ connectionString, max: 1 })
      const role =
        'login_probe_' + randomUUID().replaceAll('-', '').slice(0, 16)
      try {
        const url = new URL(
          await createLoginRole(
            admin,
            connectionString,
            role,
            'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
          )
        )
        expect(url.username).toBe(role)
        expect(url.password).toMatch(/^[0-9a-f]{48}$/)
        const stored = await admin.query<{
          scram: boolean
          rolsuper: boolean
          rolbypassrls: boolean
        }>(
          `SELECT rolpassword LIKE 'SCRAM-SHA-256$%' AS scram, rolsuper, rolbypassrls FROM pg_authid WHERE rolname = $1`,
          [role]
        )
        expect(stored.rows).toEqual([
          { scram: true, rolsuper: false, rolbypassrls: false },
        ])
        const client = new Client({ connectionString: url.toString() })
        await client.connect()
        try {
          expect(
            (
              await client.query<{ name: string }>(
                'SELECT current_user AS name'
              )
            ).rows
          ).toEqual([{ name: role }])
        } finally {
          await client.end()
        }
      } finally {
        await alterSharedAcl(admin, `DROP ROLE IF EXISTS "${role}"`)
        await admin.end()
      }
    },
    30_000
  )
})
