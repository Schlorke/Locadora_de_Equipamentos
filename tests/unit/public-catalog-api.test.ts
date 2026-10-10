import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  organization: vi.fn(),
  transaction: vi.fn(),
  equipment: vi.fn(),
  setting: vi.fn(),
  tenantSetting: vi.fn(),
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      organization: { findUnique: db.organization },
      $transaction: db.transaction,
    },
  }),
}))

import { GET as serviceEquipments } from '../../apps/services/api/src/app/api/equipments/route'
import { GET as serviceSearch } from '../../apps/services/api/src/app/api/equipamentos/search/route'
import { GET as serviceSettings } from '../../apps/services/api/src/app/api/settings/public/route'

beforeEach(() => {
  vi.resetAllMocks()
  db.organization.mockResolvedValue({
    id: 'tenant-alfa',
    status: 'ACTIVE',
    ...LIVE_SITE,
  })
  db.transaction.mockImplementation((operation) =>
    operation({
      $queryRaw: db.tenantSetting,
      equipment: { findMany: db.equipment },
      setting: { findFirst: db.setting },
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe.each([
  [
    'equipamentos',
    '/api/equipments',
    serviceEquipments,
    db.equipment,
    'Erro ao buscar equipamentos',
  ],
  [
    'busca',
    '/api/equipamentos/search',
    serviceSearch,
    db.equipment,
    'Erro interno do servidor',
  ],
  [
    'configurações',
    '/api/settings/public',
    serviceSettings,
    db.setting,
    'Não foi possível carregar as configurações públicas',
  ],
] as const)(
  '%s — erros dos adapters reais',
  (_route, path, service, read, message) => {
    it.each(['resolução de locadora', 'leitura'] as const)(
      'falha na %s preserva o 500 e não expõe o erro interno',
      async (stage) => {
        const failure = new Error('fixture-private-database-error')
        if (stage === 'resolução de locadora')
          db.organization.mockRejectedValue(failure)
        else read.mockRejectedValue(failure)

        const responses = []
        for (const handler of [service]) {
          const response = await handler(
            new NextRequest(
              `http://api.test${path}?tenantSlug=alfa&q=Betoneira`
            )
          )
          responses.push({
            status: response.status,
            body: await response.text(),
            headers: Object.fromEntries(response.headers),
          })
        }
        expect(responses[0]!.headers).toEqual({
          'content-type': 'application/json',
        })
        expect(responses[0]!.status).toBe(500)
        expect(JSON.parse(responses[0]!.body)).toEqual({ error: message })
        expect(responses[0]!.body).not.toContain('fixture-private')
        if (stage === 'resolução de locadora')
          expect(db.transaction).not.toHaveBeenCalled()
      }
    )

    it('seleção inválida não consulta o catálogo e mantém resposta neutra', async () => {
      for (const handler of [service]) {
        const response = await handler(
          new NextRequest(
            `http://api.test${path}?tenantSlug=Bad_Slug&q=Betoneira`
          )
        )
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Locadora não encontrada',
        })
        expect(response.headers.get('cache-control')).toBe('no-store')
      }
      expect(db.organization).not.toHaveBeenCalled()
      expect(db.transaction).not.toHaveBeenCalled()
      expect(read).not.toHaveBeenCalled()
    })
  }
)
