import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Publicação dos hosts novos (onda 135, Lote C: C1 e Bloco K; docs/operations/runbook-corte-raiz-legada.md).
 * O antigo vercel.json da raiz foi retirado em F; os arquivos exercitados são apps/clients/web/vercel.json e apps/services/api/vercel.json.
 * - Cada host tem o seu `vercel.json` mínimo (Root Directory = pasta do host) e declara o Node do workspace em
 *   `engines`: a Vercel usa o `engines.node` do package.json do Root Directory acima da versão do painel.
 * - A agenda da Vercel fica só no projeto da API (uma autoridade); o web nunca agenda nem recebe cron
 *   (route-table.ts nega /api/cron/** em todo host). O `cron-dispatch.yml` do GitHub agenda outros jobs: nenhum
 *   job pode ficar nas duas agendas.
 * - `sync-google-merchant` responde sempre 503 (quarentena COD-04) e `platform` só entra quando os jobs da
 *   plataforma forem ligados (C2 do plano): nenhum dos dois fica agendado.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const json = (file: string) => JSON.parse(read(file)) as Record<string, unknown>
type Cron = { path: string; schedule: string }

const API_CRONS: Cron[] = [
  { path: '/api/cron/late-fees', schedule: '0 0 * * *' },
  { path: '/api/cron/expire-quotes', schedule: '0 0 * * *' },
  { path: '/api/cron/outbox', schedule: '* * * * *' },
]

describe('vercel.json dos hosts e engines', () => {
  it('o web tem um vercel.json mínimo: Next.js, build pelo filtro do workspace e nenhuma agenda', () => {
    expect(json('apps/clients/web/vercel.json')).toEqual({
      framework: 'nextjs',
      buildCommand: 'pnpm --filter @gb-locacoes/web build',
    })
  })

  it('a API agenda exatamente os crons da Vercel, cada um numa rota GET que existe no serviço', () => {
    const api = json('apps/services/api/vercel.json')
    expect(api.framework).toBe('nextjs')
    expect(api.buildCommand).toBe('pnpm --filter @gb-locacoes/api build')
    expect(api.crons).toEqual(API_CRONS)
    for (const cron of API_CRONS) {
      const route = path.join(
        'apps/services/api/src/app',
        cron.path,
        'route.ts'
      )
      expect(fs.existsSync(path.join(ROOT, route)), route).toBe(true)
      expect(read(route)).toMatch(/export (?:async )?function GET\b/)
    }
  })

  it('nenhum job fica em duas agendas (Vercel da API e cron-dispatch do GitHub)', () => {
    const dispatched = [
      ...read('.github/workflows/cron-dispatch.yml').matchAll(
        /\/api\/cron\/[\w-]+/g
      ),
    ].map((match) => match[0])
    expect(dispatched.length).toBeGreaterThan(0)
    const scheduled = API_CRONS.map((cron) => cron.path)
    expect(scheduled.filter((job) => dispatched.includes(job))).toEqual([])
    expect(scheduled).not.toContain('/api/cron/sync-google-merchant')
    expect(scheduled).not.toContain('/api/cron/platform')
  })

  it('os dois hosts declaram o mesmo engines.node da raiz', () => {
    const node = (json('package.json').engines as { node: string }).node
    expect(node).toBe('>=24.21.0 <25')
    for (const host of [
      'apps/clients/web/package.json',
      'apps/services/api/package.json',
    ])
      expect(
        (json(host).engines as { node?: string } | undefined)?.node,
        host
      ).toBe(node)
  })
})
