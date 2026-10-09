import { expect, it } from 'vitest'
import {
  classifyHost,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { decide } from './decide'
const env = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'example.invalid',
  PLATFORM_EDGE_SECRET: 's'.repeat(32),
  WEB_API_ORIGIN: 'https://backend.invalid',
})
it('mounts /comecar on app while apex and tenant keep their distinct route trees', () => {
  const target = { pathname: '/comecar', search: '', method: 'GET' }
  expect(decide(env, classifyHost('app.example.invalid', env), target)).toEqual(
    { type: 'next' }
  )
  expect(
    decide(env, classifyHost('example.invalid', env), target)
  ).toMatchObject({
    type: 'rewrite',
    pathname: '/plataforma/comecar',
  })
  const tenant = decide(env, classifyHost('alfa.example.invalid', env), target)
  expect(tenant).toMatchObject({ type: 'rewrite', pathname: '/alfa/comecar' })
})
