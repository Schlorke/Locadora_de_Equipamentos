import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createPublicEquipmentApi } from './public-equipment'

it('lê detalhe na origem configurada e preserva defaults/direto zero do parser web', async () => {
  const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
    Response.json({
      id: 'eq-1',
      name: 'Betoneira',
      pricePerDay: 100,
      category: { id: 'c1', name: 'Obra' },
      weeklyUseDirectValue: true,
      weeklyDirectValue: 0,
      monthlyRentalEnabled: false,
    })
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const e = await createPublicEquipmentApi(client).read('alfa', 'eq-1')
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/equipments/eq-1?tenantSlug=alfa'
  )
  expect(e).toMatchObject({
    description: null,
    images: [],
    weeklyDirectValue: 0,
    weeklyUseDirectValue: true,
    maxStock: 1,
    dailyRentalEnabled: true,
    monthlyRentalEnabled: false,
  })
})
it('slug/id inválidos não chamam o transporte; 404 é ausência neutra', async () => {
  const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
    Response.json({ error: 'Não encontrado' }, { status: 404 })
  )
  const api = createPublicEquipmentApi(
    createHttpClient({ baseUrl: 'https://api.example.test', fetcher })
  )
  expect(await api.read('api', 'eq-1')).toBeNull()
  expect(await api.read('alfa', '../foreign')).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
  expect(await api.read('alfa', 'eq-1')).toBeNull()
})
it('corpo malformado e indisponibilidade continuam erros, não ausência', async () => {
  const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
    Response.json({ id: 'eq-1' })
  )
  const api = createPublicEquipmentApi(
    createHttpClient({ baseUrl: 'https://api.example.test', fetcher })
  )
  await expect(api.read('alfa', 'eq-1')).rejects.toThrow(
    'Resposta inválida do catálogo'
  )
  fetcher.mockImplementation(async (_input: string, _init?: RequestInit) =>
    Response.json({ error: 'Fora' }, { status: 503 })
  )
  await expect(api.read('alfa', 'eq-1')).rejects.toMatchObject({ status: 503 })
})
