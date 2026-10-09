import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { alterSharedAcl } from './shared-acl'
import { requireTestDatabase } from './test-database'

/**
 * Privileged fixture changes use a real restricted role, never disable projection triggers. The grants and the
 * role removal go through the shared ACL lock (`./shared-acl`): parallel test files grant on the same schema and
 * table, and two concurrent catalog updates would fail with XX000 "tuple concurrently updated".
 */
export async function withTestPlatformTransaction<T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const target = new URL(requireTestDatabase(process.env)).pathname.slice(1)
  const rows = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`
  if (rows[0]?.name !== target)
    throw new Error('Platform fixture database mismatch')
  const role = 'test_platform_fixture_' + randomUUID().replaceAll('-', '')
  await prisma.$executeRawUnsafe(
    `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`
  )
  try {
    await alterSharedAcl(prisma, [
      `GRANT USAGE ON SCHEMA public TO "${role}"`,
      `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
    ])
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`)
      await tx.$queryRaw`SELECT set_config('app.platform_scope','on',true)`
      return operation(tx)
    })
  } finally {
    await alterSharedAcl(prisma, [
      `DROP OWNED BY "${role}"`,
      `DROP ROLE "${role}"`,
    ])
  }
}
