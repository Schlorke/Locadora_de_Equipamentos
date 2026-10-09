import { expect, it, vi } from 'vitest'
import { readPublicMonthlyPlans } from './public-plans'
it('requires the strict public catalog response instead of displaying arbitrary provider fields', async () => {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    data: { plans: [], secret: 'forged' },
  })
  await expect(readPublicMonthlyPlans({ request })).rejects.toThrow(
    'Catálogo indisponível.'
  )
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/public/plans', {
    responseType: 'json-response',
  })
  request.mockResolvedValue({ ok: true, status: 200, data: { plans: [] } })
  expect(await readPublicMonthlyPlans({ request })).toEqual([])
})
