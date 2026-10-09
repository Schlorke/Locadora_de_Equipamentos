import { describe, expect, it } from 'vitest'
import { isVisualRscPrefetch } from './prefetch.mjs'

const prefetch = () => ({
  production: true,
  method: 'GET',
  resourceType: 'fetch',
  isNavigationRequest: false,
  pathname: '/orcamento',
  headers: { rsc: '1', 'next-router-prefetch': '1' },
})

const otherHeaders: Record<string, string>[] = [
  {},
  { rsc: '1' },
  { 'next-router-prefetch': '1' },
  { rsc: '1', 'next-router-state-tree': 'current-tree' },
  { rsc: '0', 'next-router-prefetch': '1' },
  { rsc: '1', 'next-router-prefetch': '0' },
  { rsc: '1', 'next-router-prefetch': '2' },
  { rsc: '1', 'next-router-prefetch': '3' },
  { rsc: '1', 'next-router-prefetch': 'true' },
  { rsc: '1', purpose: 'prefetch' },
  { rsc: '1', 'sec-purpose': 'prefetch' },
]

describe('visual production RSC prefetch', () => {
  it('recognizes the explicit fetch variant without changing its inputs', () => {
    const request = prefetch()
    const before = JSON.stringify(request)
    expect(isVisualRscPrefetch(request)).toBe(true)
    expect(JSON.stringify(request)).toBe(before)
  })

  it('keeps the development capture unchanged', () => {
    expect(isVisualRscPrefetch({ ...prefetch(), production: false })).toBe(
      false
    )
  })

  it('preserves a real navigation even when it carries prefetch headers', () => {
    expect(
      isVisualRscPrefetch({ ...prefetch(), isNavigationRequest: true })
    ).toBe(false)
  })

  it.each(['POST', 'HEAD', 'PUT'])('preserves method %s', (method) => {
    expect(isVisualRscPrefetch({ ...prefetch(), method })).toBe(false)
  })

  it.each(['document', 'script', 'xhr'])(
    'preserves resource type %s',
    (resourceType) => {
      expect(isVisualRscPrefetch({ ...prefetch(), resourceType })).toBe(false)
    }
  )

  it.each([
    '/api',
    '/api/onboarding/status',
    '/_next',
    '/_next/static/chunks/hash.js',
  ])('preserves protected path %s', (pathname) => {
    expect(isVisualRscPrefetch({ ...prefetch(), pathname })).toBe(false)
  })

  it.each(['/apiary', '/_next-page', '/sobre', '/contato', '/cookies'])(
    'matches only real route segments at %s',
    (pathname) => {
      expect(isVisualRscPrefetch({ ...prefetch(), pathname })).toBe(true)
    }
  )

  it.each(otherHeaders)(
    'preserves requests without the two exact headers: %j',
    (headers) => {
      expect(isVisualRscPrefetch({ ...prefetch(), headers })).toBe(false)
    }
  )
})
