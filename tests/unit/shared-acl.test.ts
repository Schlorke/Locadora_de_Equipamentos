import { randomUUID } from 'node:crypto'
import { Client, Pool, type PoolClient } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  alterSharedAcl,
  alterSharedAclInTransaction,
  type SharedAclDatabase,
  type SharedAclTransaction,
} from '../helpers/shared-acl'
import { requireTestDatabase } from '../helpers/test-database'

/**
 * Corrida de catálogo da onda 133: dois arquivos de teste concedendo no mesmo objeto ao mesmo tempo faziam o segundo
 * falhar com XX000 "tuple concurrently updated". Cada caso deixa uma transação com uma alteração de ACL pendente no
 * schema public e em organizations e prova que a outra alteração ESPERA o lock do helper e passa depois do COMMIT
 * (sem o lock, ela espera a transação e falha com XX000). Esperar não basta: para cada forma de escritor (pg.Client,
 * pg.Pool, PrismaClient), o escritor parado no meio das próprias instruções ainda segura o lock, e uma rajada de
 * escritores daquela forma termina sem nenhuma recusa (lock tomado fora da transação deixa as duas provas vermelhas).
 * O pg.Pool tem mais de uma conexão: a alteração usa uma conexão só dela do começo ao COMMIT, e um pedido que espera
 * vaga no mesmo pool só a recebe depois, fora de transação (instrução solta em `pool.query` deixa essa prova vermelha).
 *
 * As esperas são lidas pelo lock exato (o do helper ou a pausa própria do caso): no test:unit, outros arquivos do
 * mesmo banco seguram o lock do helper a qualquer momento, e o escritor pode estar na fila dele antes da pausa.
 */
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Shared ACL changes serialized under real PostgreSQL contention',
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
    const roles: string[] = []
    let connectionString: string
    let admin: Pool

    const newRole = async () => {
      const role = 'shared_acl_' + suffix + '_' + roles.length
      roles.push(role)
      await admin.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`)
      return role
    }
    const grantAccess = (db: SharedAclDatabase, role: string) =>
      alterSharedAcl(db, [
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
        `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
      ])
    const grantAccessInTransaction = (tx: SharedAclTransaction, role: string) =>
      alterSharedAclInTransaction(tx, [
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
        `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
      ])
    /** Entradas da ACL do próprio papel (PUBLIC já tem USAGE no schema public e esconderia a diferença). */
    const privileges = async (role: string) =>
      (
        await admin.query<{ usage: boolean; select: boolean }>(
          `SELECT
             EXISTS (SELECT 1 FROM pg_namespace n, aclexplode(n.nspacl) a
                      WHERE n.nspname = 'public' AND a.grantee = to_regrole($1) AND a.privilege_type = 'USAGE') AS usage,
             EXISTS (SELECT 1 FROM pg_class c, aclexplode(c.relacl) a
                      WHERE c.oid = 'public.organizations'::regclass AND a.grantee = to_regrole($1)
                        AND a.privilege_type = 'SELECT') AS select`,
          [role]
        )
      ).rows[0]

    /**
     * Lock consultivo só deste teste (par de chaves diferente do helper): uma instrução que o pede para o escritor no
     * meio da própria transação, depois da primeira alteração e antes do COMMIT, até o teste soltá-lo.
     */
    const PAUSE_KEY = `hashtext('gb-locacoes:tests:shared-acl-pause'), hashtext('${suffix}')`

    /**
     * Locks da sessão `pid` (concedidos ou esperados), cada um pelo nome: `helper` é o par de chaves exato de
     * tests/helpers/shared-acl.ts, `pause` o deste teste; qualquer outro sai como o tipo do lock.
     */
    const locksOf = async (pid: number, granted: boolean) =>
      (
        await admin.query<{ lock: string }>(
          `SELECT CASE
                    WHEN locktype = 'advisory' AND objsubid = 2
                     AND classid::bigint = (hashtext('gb-locacoes:tests')::bigint & 4294967295)
                     AND objid::bigint = (hashtext('shared-acl')::bigint & 4294967295) THEN 'helper'
                    WHEN locktype = 'advisory' AND objsubid = 2
                     AND classid::bigint = (hashtext('gb-locacoes:tests:shared-acl-pause')::bigint & 4294967295)
                     AND objid::bigint = (hashtext($3)::bigint & 4294967295) THEN 'pause'
                    ELSE locktype
                  END AS lock
             FROM pg_locks
            WHERE pid = $1 AND granted = $2 AND (NOT $2 OR locktype = 'advisory')
            ORDER BY 1`,
          [pid, granted, suffix]
        )
      ).rows.map((row) => row.lock)

    /** Locks consultivos que a sessão `pid` segura agora. */
    const heldAdvisoryLocks = (pid: number) => locksOf(pid, true)

    /**
     * Espera a sessão `pid` aguardar exatamente o lock `lock` e devolve tudo o que ela aguarda nesse momento. A espera
     * por outro lock antes dele (a fila do helper enquanto outro arquivo de teste o segura) não conta.
     */
    async function waitingOn(pid: number, lock: 'helper' | 'pause') {
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        const waits = await locksOf(pid, false)
        if (waits.includes(lock)) return waits
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error(`Session ${pid} never waited for the ${lock} lock`)
    }

    const pending = <T>(promise: Promise<T>) =>
      Promise.race([
        promise.then(() => 'settled'),
        new Promise((resolve) => setTimeout(() => resolve('pending'), 150)),
      ])

    /**
     * Cada forma de banco que os testes passam ao helper, com o pid da conexão que ele vai usar: a única aberta (o
     * pg.Pool abre a segunda só quando alguém pede uma conexão enquanto a primeira está em uso).
     */
    const writers = {
      'pg.Client': async () => {
        const client = new Client({ connectionString })
        await client.connect()
        const pid = (await client.query('SELECT pg_backend_pid() AS pid'))
          .rows[0].pid as number
        return { db: client, pid, close: () => client.end() }
      },
      'pg.Pool': async () => {
        // Mais de uma conexão, como o pool de um arquivo de teste: instrução solta em `pool.query` pode cair em outra.
        const pool = new Pool({
          connectionString,
          max: 2,
          idleTimeoutMillis: 0,
        })
        const pid = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0]
          .pid as number
        return { db: pool, pid, pool, close: () => pool.end() }
      },
      PrismaClient: async () => {
        const pool = new Pool({
          connectionString,
          max: 1,
          idleTimeoutMillis: 0,
        })
        const pid = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0]
          .pid as number
        const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
        return {
          db: prisma,
          pid,
          close: async () => {
            await prisma.$disconnect()
            await pool.end()
          },
        }
      },
    } satisfies Record<
      string,
      () => Promise<{
        db: SharedAclDatabase
        pid: number
        pool?: Pool
        close(): Promise<void>
      }>
    >

    beforeAll(() => {
      if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
        throw new Error('Disposable database opt-in required')
      connectionString = requireTestDatabase(process.env)
      admin = new Pool({ connectionString, max: 2 })
    })

    afterAll(async () => {
      if (!admin) return
      const created = await admin.query<{ rolname: string }>(
        'SELECT rolname FROM pg_roles WHERE rolname = ANY($1)',
        [roles]
      )
      for (const { rolname: role } of created.rows)
        await alterSharedAcl(admin, [
          `DROP OWNED BY "${role}"`,
          `DROP ROLE "${role}"`,
        ])
      await admin.end()
    }, 60_000)

    it.each(Object.keys(writers) as (keyof typeof writers)[])(
      'makes a change through %s wait for the pending one and then commit',
      async (kind) => {
        const [first, second] = [await newRole(), await newRole()]
        const holder = new Client({ connectionString })
        await holder.connect()
        const writer = await writers[kind]()
        try {
          await holder.query('BEGIN')
          await grantAccessInTransaction(holder, first)
          const result = grantAccess(writer.db, second).then(
            () => 'committed',
            (error: unknown) => error
          )
          expect(await waitingOn(writer.pid, 'helper')).toEqual(['helper'])
          expect(await pending(result)).toBe('pending')
          await holder.query('COMMIT')
          expect(await result).toBe('committed')
          expect(await privileges(first)).toEqual({ usage: true, select: true })
          expect(await privileges(second)).toEqual({
            usage: true,
            select: true,
          })
        } finally {
          await holder.query('ROLLBACK').catch(() => undefined)
          await holder.end()
          await writer.close()
        }
      },
      30_000
    )

    it('holds the lock until the end of a Prisma interactive transaction', async () => {
      const [first, second] = [await newRole(), await newRole()]
      const pool = new Pool({ connectionString, max: 1 })
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
      const writer = await writers['pg.Client']()
      try {
        let result: Promise<unknown> | undefined
        await prisma.$transaction(
          async (tx) => {
            await grantAccessInTransaction(tx, first)
            result = grantAccess(writer.db, second).then(
              () => 'committed',
              (error: unknown) => error
            )
            expect(await waitingOn(writer.pid, 'helper')).toEqual(['helper'])
            expect(await pending(result)).toBe('pending')
          },
          { timeout: 20_000 }
        )
        expect(await result).toBe('committed')
        expect(await privileges(second)).toEqual({ usage: true, select: true })
      } finally {
        await writer.close()
        await prisma.$disconnect()
        await pool.end()
      }
    }, 30_000)

    it.each(Object.keys(writers) as (keyof typeof writers)[])(
      'holds the lock through %s from its first statement until its own COMMIT',
      async (kind) => {
        const [role, other] = [await newRole(), await newRole()]
        const pause = new Client({ connectionString })
        await pause.connect()
        const writer = await writers[kind]()
        const competitor = await writers['pg.Client']()
        const pool = 'pool' in writer ? writer.pool : undefined
        let result: Promise<unknown> | undefined
        let queued: Promise<unknown> | undefined
        let spare: PoolClient | undefined
        let probe: Promise<unknown> | undefined
        try {
          await pause.query(`SELECT pg_advisory_lock(${PAUSE_KEY})`)
          result = alterSharedAcl(writer.db, [
            `GRANT USAGE ON SCHEMA public TO "${role}"`,
            `SELECT pg_advisory_xact_lock(${PAUSE_KEY})`,
            `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
          ]).then(
            () => 'committed',
            (error: unknown) => error
          )
          // Parado na pausa: a primeira instrução já rodou e a transação dele segue aberta, ainda com o lock do helper.
          expect(await waitingOn(writer.pid, 'pause')).toEqual(['pause'])
          expect(await heldAdvisoryLocks(writer.pid)).toEqual(['helper'])
          expect(await privileges(role)).toEqual({
            usage: false,
            select: false,
          })
          if (pool) {
            // A outra conexão do pool fica com o teste; o pedido seguinte espera vaga e só pode receber a conexão da
            // alteração quando ela a devolver, depois do COMMIT. Instrução solta em `pool.query` devolveria a conexão
            // entre uma instrução e outra, com a transação ainda aberta.
            spare = await pool.connect()
            expect(
              (await spare.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
            ).not.toBe(writer.pid)
            probe = pool
              .query<{ pid: number; outsideTransaction: boolean }>(
                `SELECT pg_backend_pid() AS pid,
                        pg_current_xact_id_if_assigned() IS NULL AS "outsideTransaction"`
              )
              .then((answer) => answer.rows[0])
            expect(await pending(probe)).toBe('pending')
          }
          // Outra alteração fica na fila desse lock, e não na linha de catálogo que ele já regravou.
          queued = grantAccess(competitor.db, other).then(
            () => 'committed',
            (error: unknown) => error
          )
          expect(await waitingOn(competitor.pid, 'helper')).toEqual(['helper'])
          await pause.query(`SELECT pg_advisory_unlock(${PAUSE_KEY})`)
          expect(await result).toBe('committed')
          if (pool)
            expect(await probe).toEqual({
              pid: writer.pid,
              outsideTransaction: true,
            })
          expect(await queued).toBe('committed')
          expect(await privileges(role)).toEqual({ usage: true, select: true })
          expect(await privileges(other)).toEqual({ usage: true, select: true })
          expect(await heldAdvisoryLocks(writer.pid)).toEqual([])
        } finally {
          await pause
            .query('SELECT pg_advisory_unlock_all()')
            .catch(() => undefined)
          await Promise.allSettled([result, queued])
          spare?.release()
          await Promise.allSettled([probe])
          await pause.end()
          await competitor.close()
          await writer.close()
        }
      },
      30_000
    )

    it.each(Object.keys(writers) as (keyof typeof writers)[])(
      'commits every change of a burst of parallel test files writing through %s',
      async (kind) => {
        const burst = await Promise.all(
          Array.from({ length: 12 }, async () => ({
            writer: await writers[kind](),
            role: await newRole(),
          }))
        )
        try {
          for (let round = 0; round < 3; round++) {
            const results = await Promise.allSettled(
              burst.map(({ writer, role }) =>
                round % 2 === 0
                  ? grantAccess(writer.db, role)
                  : alterSharedAcl(writer.db, [
                      `REVOKE SELECT, UPDATE ON organizations FROM "${role}"`,
                      `REVOKE USAGE ON SCHEMA public FROM "${role}"`,
                    ])
              )
            )
            expect(results.filter((r) => r.status === 'rejected')).toEqual([])
          }
          for (const { role } of burst)
            expect(await privileges(role)).toEqual({
              usage: true,
              select: true,
            })
        } finally {
          for (const { writer } of burst) await writer.close()
        }
      },
      30_000
    )

    it.each(Object.keys(writers) as (keyof typeof writers)[])(
      'rolls back the whole change through %s when one statement fails',
      async (kind) => {
        const role = await newRole()
        const writer = await writers[kind]()
        try {
          const failure = await alterSharedAcl(writer.db, [
            `GRANT USAGE ON SCHEMA public TO "${role}"`,
            `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
            `GRANT SELECT ON shared_acl_missing_${suffix} TO "${role}"`,
          ]).then(
            () => undefined,
            (error: { code?: string; message?: string }) => error
          )
          // pg devolve o SQLSTATE em `code`; o Prisma o repete na mensagem do P2010.
          expect(`${failure?.code} ${failure?.message}`).toContain('42P01')
          expect(await privileges(role)).toEqual({
            usage: false,
            select: false,
          })
          // A conexão segue utilizável para a próxima alteração.
          await grantAccess(writer.db, role)
          expect(await privileges(role)).toEqual({ usage: true, select: true })
        } finally {
          await writer.close()
        }
      },
      30_000
    )

    it('refuses a change without a statement', async () => {
      await expect(alterSharedAcl(admin, [])).rejects.toThrow(
        'Shared ACL change without a statement'
      )
      await expect(alterSharedAcl(admin, ' ')).rejects.toThrow(
        'Shared ACL change without a statement'
      )
    })
  }
)
