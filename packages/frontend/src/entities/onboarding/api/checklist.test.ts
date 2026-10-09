import { expect, it } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { readOnboardingChecklist } from './checklist'
import { onboardingChecklistFixture } from '../../../../../../tests/helpers/onboarding-checklist'
it('lê contrato estrito e usa somente o caminho autenticado sem seleção no corpo/query', async () => {
  const paths: string[] = []
  const data = await readOnboardingChecklist(
    createHttpClient({
      fetcher: async (path) => {
        paths.push(path)
        return Response.json(onboardingChecklistFixture())
      },
    })
  )
  expect(paths).toEqual(['/api/onboarding/status'])
  expect(data).toEqual(onboardingChecklistFixture())
})
it.each([
  [401, {}, 'session'],
  [403, { code: 'OWNER_REQUIRED' }, 'owner'],
  [403, { code: 'APP_HOST_REQUIRED' }, 'unavailable'],
  [409, { code: 'TENANT_REQUIRED' }, 'selection'],
  [503, { error: 'private-driver-text' }, 'unavailable'],
  [200, { ...onboardingChecklistFixture(), secret: 'private' }, 'unavailable'],
  [200, { subscriptionStatus: 'TRIALING', items: [] }, 'unavailable'],
  [
    200,
    {
      ...onboardingChecklistFixture(),
      items: onboardingChecklistFixture().items.slice().reverse(),
    },
    'unavailable',
  ],
])('recusa resposta %s sem expor detalhes', async (status, body, problem) => {
  await expect(
    readOnboardingChecklist(
      createHttpClient({
        fetcher: async () => Response.json(body, { status: Number(status) }),
      })
    )
  ).rejects.toMatchObject({ problem })
})
it('falta de assinatura antiga não inventa etapas nem falha visível', async () => {
  expect(
    await readOnboardingChecklist(
      createHttpClient({
        fetcher: async () =>
          Response.json({ code: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404 }),
      })
    )
  ).toBeNull()
})
it('404 arbitrário não esconde falha de contrato/transporte', async () => {
  await expect(
    readOnboardingChecklist(
      createHttpClient({
        fetcher: async () => Response.json({}, { status: 404 }),
      })
    )
  ).rejects.toMatchObject({ problem: 'unavailable' })
})
