import type { PlatformRateLimitDatabase } from '@gb-locacoes/backend/directory'

type Row = { count: number; expiresAt: Date }
type UpsertArgs = {
  where: { key: string }
  create: { key: string; count: number; expiresAt: Date }
  update: { count: { increment: number } }
}
type DeleteManyArgs = {
  where: {
    key?: { in?: string[]; startsWith?: string }
    expiresAt?: { lt: Date }
  }
}

/**
 * Dublê em memória de `prisma.platformRateLimit` para suítes sem banco, com a
 * semântica do subconjunto que `prismaRateLimitCounter` e
 * `purgeExpiredPlatformRateLimits` usam: upsert que cria com o valor de
 * `create` ou incrementa, e `deleteMany` por chave exata, prefixo ou
 * expiração. Um prefixo com `%`, `_` ou `\` falha, porque o Prisma não escapa
 * curingas no LIKE. A prova de atomicidade e de persistência fica nos blocos
 * com banco descartável.
 */
export function createPlatformRateLimitTable() {
  const rows = new Map<string, Row>()
  const platformRateLimit = {
    async upsert(args: UpsertArgs): Promise<{ count: number }> {
      if (args.create.key !== args.where.key)
        throw new Error('upsert must create the key it looks up')
      const current = rows.get(args.where.key)
      const next: Row = current
        ? { ...current, count: current.count + args.update.count.increment }
        : { count: args.create.count, expiresAt: args.create.expiresAt }
      rows.set(args.where.key, next)
      return { count: next.count }
    },
    async deleteMany(args: DeleteManyArgs): Promise<{ count: number }> {
      const { key, expiresAt } = args.where
      if (key?.startsWith !== undefined && /[%_\\]/.test(key.startsWith))
        throw new Error('LIKE wildcard in a rate limit prefix')
      let count = 0
      for (const [name, row] of [...rows]) {
        if (key?.in && !key.in.includes(name)) continue
        if (key?.startsWith !== undefined && !name.startsWith(key.startsWith))
          continue
        if (expiresAt && !(row.expiresAt < expiresAt.lt)) continue
        rows.delete(name)
        count++
      }
      return { count }
    },
  }
  return {
    rows,
    database: { platformRateLimit } as unknown as PlatformRateLimitDatabase,
    platformRateLimit,
  }
}
