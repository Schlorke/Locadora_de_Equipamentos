import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
if (process.env.TEST_DATABASE_DISPOSABLE !== 'true') throw new Error('Disposable database opt-in required')
const connection = requireTestDatabase(process.env)
const db = new Client({ connectionString: connection })
let id: string
beforeAll(async () => {
  await db.connect()
})
afterAll(async () => {
  await db.end()
})
beforeEach(async () => {
  id = randomUUID()
  await db.query('BEGIN')
  await db.query(
    `INSERT INTO organizations (id,slug,name,"updatedAt") VALUES ($1,$1,'Fixture',now()),($2,$2,'Other fixture',now())`,
    [id, id + '-b']
  )
  await db.query(
    `INSERT INTO users (id,email,"updatedAt") VALUES ($1,$2,now())`,
    [id, id + '@example.test']
  )
  await db.query(
    `INSERT INTO rentals (id,"tenantId",userid,startdate,enddate,total) VALUES ($1,$1,$1,now(),now(),100)`,
    [id]
  )
  await db.query(
    `INSERT INTO contracts (id,"tenantId","rentalId",content,status,"updatedAt") VALUES ($1,$1,$1,'Immutable agreement','SIGNED',now())`,
    [id]
  )
  await db.query(
    `INSERT INTO tenant_integrations (id,"tenantId",provider,"credentialsRef","updatedAt") VALUES ($1,$1,'ZAPSIGN','env:LOCADORA_INTEGRATION_TEST',now()),($2,$2,'ZAPSIGN','env:LOCADORA_INTEGRATION_TEST_OTHER',now())`,
    [id, id + '-b']
  )
})
afterEach(async () => {
  await db.query('ROLLBACK')
})

describe('signed agreement database invariants', () => {
  it.each(['content', 'status', 'delete'])(
    'blocks %s mutation independently of HTTP authorization',
    async (field) => {
      const query =
        field === 'delete'
          ? 'DELETE FROM contracts WHERE id=$1'
          : field === 'status'
            ? `UPDATE contracts SET status='DRAFT' WHERE id=$1`
            : `UPDATE contracts SET content='Changed' WHERE id=$1`
      await expect(db.query(query, [id])).rejects.toMatchObject({
        code: '23514',
        message: 'SIGNED_CONTRACT_IMMUTABLE',
      })
    }
  )
  it('permits one private archive reference but rejects replacing it', async () => {
    await db.query(`UPDATE contracts SET "pdfUrl"=$2 WHERE id=$1`, [
      id,
      `private:tenants/${id}/clients/${id}/agreement.pdf`,
    ])
    await expect(
      db.query(`UPDATE contracts SET "pdfUrl"=$2 WHERE id=$1`, [
        id,
        `private:tenants/${id}/clients/${id}/other.pdf`,
      ])
    ).rejects.toMatchObject({ code: '23514' })
  })
  it('does not archive a signed agreement under another tenant', async () => {
    await expect(
      db.query(`UPDATE contracts SET "pdfUrl"=$2 WHERE id=$1`, [
        id,
        `private:tenants/${id}-B/clients/${id}/agreement.pdf`,
      ])
    ).rejects.toMatchObject({ code: '23514' })
  })
  it('cannot attach an integration from another tenant to a signature attempt', async () => {
    await expect(
      db.query(
        `INSERT INTO contract_signature_attempts (id,"tenantId","contractId","integrationId","eventId","updatedAt") VALUES ($1,$1,$1,$2,$1,now())`,
        [id, id + '-b']
      )
    ).rejects.toMatchObject({ code: '23503' })
  })
  it('enables and forces RLS on signature attempts', async () => {
    const result = await db.query(
      `SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='contract_signature_attempts'`
    )
    expect(result.rows).toEqual([
      { relrowsecurity: true, relforcerowsecurity: true },
    ])
  })
  it('accepts the same provider event key on two different integration bindings', async () => {
    await db.query(
      `INSERT INTO webhook_inbox (id,"tenantId","integrationId",provider,"eventKey",payload) VALUES ($1,$2,$2,'ZAPSIGN','same-event','{}'),($3,$4,$4,'ZAPSIGN','same-event','{}')`,
      [id + '-in-A', id, id + '-in-B', id + '-b']
    )
    await expect(
      db.query(
        `INSERT INTO webhook_inbox (id,"tenantId","integrationId",provider,"eventKey",payload) VALUES ($1,$2,$2,'ZAPSIGN','same-event','{}')`,
        [id + '-duplicate', id]
      )
    ).rejects.toMatchObject({ code: '23505' })
  })
  it('rejects a webhook receipt tied to another tenants integration', async () => {
    await expect(
      db.query(
        `INSERT INTO webhook_inbox (id,"tenantId","integrationId",provider,"eventKey",payload) VALUES ($1,$1,$2,'ZAPSIGN','event','{}')`,
        [id, id + '-b']
      )
    ).rejects.toMatchObject({ code: '23503' })
  })
  it('stores separate Zoho grants for one global identity in two tenants', async () => {
    await db.query(
      `INSERT INTO zoho_mail_tokens (id,"tenantId","userId","accessToken","refreshToken","expiresAt","updatedAt") VALUES ($1,$2,$2,'fixture','fixture',now(),now()),($3,$4,$2,'fixture','fixture',now(),now())`,
      [id + '-grant-A', id, id + '-grant-B', id + '-b']
    )
    const rows = await db.query(
      'SELECT count(*)::int AS count FROM zoho_mail_tokens WHERE "userId"=$1',
      [id]
    )
    expect(rows.rows[0].count).toBe(2)
  })
})
