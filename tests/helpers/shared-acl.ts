import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Única porta dos testes para alterar ACL de objeto compartilhado do banco de teste (onda 134).
 *
 * Os arquivos de teste rodam em paralelo no mesmo banco descartável e vários concedem e revogam privilégios nos mesmos
 * objetos (schema public, organizations, settings, categories, addresses...). GRANT, REVOKE, DROP OWNED e ALTER ...
 * OWNER TO regravam a linha do objeto no catálogo (pg_namespace, pg_class, pg_proc, pg_database); quando duas sessões
 * regravam a mesma linha ao mesmo tempo, a segunda falha com XX000 "tuple concurrently updated", sem espera nem nova
 * tentativa do PostgreSQL. Aqui toda alteração dessas roda numa transação que começa pelo mesmo lock consultivo de
 * transação, de chave fixa: quem chega depois espera o COMMIT de quem está alterando e regrava a linha já atualizada.
 * DROP ROLE entra pelo mesmo caminho, logo depois do DROP OWNED que o antecede.
 *
 * `tests/unit/shared-acl.gate.test.ts` reprova GRANT, REVOKE, DROP OWNED, DROP ROLE, ALTER ... OWNER TO e a aplicação
 * de `prisma/sql/roles/*.sql` fora destas duas funções nos diretórios de teste, salvo a lista motivada de quem usa
 * banco ou schema próprio.
 */

/**
 * Lock consultivo de transação no espaço de duas chaves, com o par próprio dos testes (`gb-locacoes:tests`,
 * `shared-acl`): os locks da aplicação usam uma chave `bigint` ou o par `gb-locacoes:rental-mutations`. Vale até o
 * COMMIT ou ROLLBACK da transação que o tomou.
 */
const SHARED_ACL_LOCK_SQL =
  "SELECT pg_advisory_xact_lock(hashtext('gb-locacoes:tests'), hashtext('shared-acl'))"

/** Uma instrução ou várias, executadas na ordem e na mesma transação. */
export type SharedAclStatements = string | readonly string[]

/** Sessão `pg` (Client ou PoolClient) ou cliente de uma transação já aberta com BEGIN. */
export interface SqlSession {
  query(text: string): Promise<unknown>
}

/** `pg.Pool`: a alteração usa uma conexão própria do pool e a devolve ao final. */
export interface SqlPool {
  readonly totalCount: number
  connect(): Promise<SqlSession & { release(destroy?: boolean): void }>
}

/** Onde `alterSharedAcl` abre a transação: Prisma, pool `pg` ou sessão `pg` fora de transação. */
export type SharedAclDatabase = PrismaClient | SqlPool | SqlSession

/** Transação já aberta pelo chamador: a interativa do Prisma ou uma sessão `pg` depois do BEGIN. */
export type SharedAclTransaction = Prisma.TransactionClient | SqlSession

function statementsOf(statements: SharedAclStatements): readonly string[] {
  const list = typeof statements === 'string' ? [statements] : statements
  if (list.length === 0 || list.some((statement) => !statement.trim()))
    throw new Error('Shared ACL change without a statement')
  return list
}

async function lockAndRun(
  tx: SharedAclTransaction,
  statements: readonly string[]
): Promise<void> {
  const execute =
    '$executeRawUnsafe' in tx
      ? (sql: string) => tx.$executeRawUnsafe(sql)
      : (sql: string) => tx.query(sql)
  await execute(SHARED_ACL_LOCK_SQL)
  for (const statement of statements) await execute(statement)
}

/** BEGIN, lock, instruções e COMMIT; ROLLBACK em qualquer falha, que segue para o chamador. */
async function inSession(
  session: SqlSession,
  statements: readonly string[]
): Promise<void> {
  await session.query('BEGIN')
  try {
    await lockAndRun(session, statements)
    await session.query('COMMIT')
  } catch (error) {
    await session.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}

/**
 * Altera ACL de objeto compartilhado numa transação própria, serializada com todas as outras alterações dos testes.
 * Um script com BEGIN/COMMIT próprios (os de `prisma/sql/roles`) roda dentro dela: o BEGIN vira aviso e o COMMIT
 * do script encerra a transação depois da última instrução, ainda com o lock.
 */
export async function alterSharedAcl(
  db: SharedAclDatabase,
  statements: SharedAclStatements
): Promise<void> {
  const list = statementsOf(statements)
  if ('$transaction' in db) {
    await db.$transaction((tx) => lockAndRun(tx, list), {
      maxWait: 10_000,
      timeout: 20_000,
    })
    return
  }
  if ('totalCount' in db) {
    const session = await db.connect()
    let failed = false
    try {
      await inSession(session, list)
    } catch (error) {
      failed = true
      throw error
    } finally {
      // Conexão que falhou no meio da transação não volta ao pool.
      session.release(failed)
    }
    return
  }
  await inSession(db, list)
}

/**
 * Mesma alteração dentro de uma transação que o chamador já abriu (papel restrito criado, usado e removido na mesma
 * transação). Tome-o antes de tocar linhas que outra transação com o lock possa disputar: o lock vale até o COMMIT
 * do chamador e é reentrante dentro dela.
 */
export async function alterSharedAclInTransaction(
  tx: SharedAclTransaction,
  statements: SharedAclStatements
): Promise<void> {
  await lockAndRun(tx, statementsOf(statements))
}
