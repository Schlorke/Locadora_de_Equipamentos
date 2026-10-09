import { randomBytes } from 'node:crypto'
import type { Pool } from 'pg'

const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`

/**
 * Creates a LOGIN role with a random password and returns a connection string for it on the same server and
 * database as `connectionString`. The password is required: the CI service (postgres:18 with
 * POSTGRES_PASSWORD) authenticates TCP clients with scram-sha-256, where a role without password cannot
 * log in; a local cluster in trust mode simply ignores it.
 */
export async function createLoginRole(
  admin: Pool,
  connectionString: string,
  role: string,
  attributes: string
): Promise<string> {
  // Hex only, so the literal needs no escaping (CREATE ROLE takes no bind parameters).
  const password = randomBytes(24).toString('hex')
  await admin.query(
    `CREATE ROLE ${quoteIdentifier(role)} LOGIN PASSWORD '${password}' ${attributes}`
  )
  const url = new URL(connectionString)
  url.username = role
  url.password = password
  return url.toString()
}
