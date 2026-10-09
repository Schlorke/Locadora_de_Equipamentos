import { expect } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ApiParityContext } from './global-setup'

export function sessionCookies(response: Response, prior = '') {
  const jar = new Map(
    prior
      .split('; ')
      .filter(Boolean)
      .map((entry) => {
        const split = entry.indexOf('=')
        return [entry.slice(0, split), entry.slice(split + 1)] as const
      })
  )
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(';')[0]!
    const split = pair.indexOf('=')
    jar.set(pair.slice(0, split), pair.slice(split + 1))
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

// Cookies come from the live HTTP engine of the shared API (onda 135, E1: the
// API runs in every parity run, the legacy root only while it exists), never a
// mocked session or test-only authentication header. Both hosts read the same
// database sessions and the same NEXTAUTH_SECRET, so the cookie is valid on
// every host of the run. Only the request's Cookie is replayed.
export async function signInParityUser(
  context: ApiParityContext,
  edge: Record<string, string>,
  index: number,
  options: { fresh?: boolean } = {}
) {
  const mode = context.identity.mode
  const user = context.identity.users[index]!
  // Every engine request belongs to this run's reserved test subnet, including
  // cookie-cache probes. Keep budgets real and let teardown remove only ours.
  const ip = edge['x-platform-client-ip'] ?? context.directory.ips[61 + index]!
  const headers = {
    'x-platform-client-ip': ip,
    // The native engine reads x-forwarded-for separately from the platform guard.
    'x-forwarded-for': ip,
    ...edge,
  }
  const cacheFile = path.join(
    context.sessionCacheDirectory,
    `${user.id}.cookie`
  )
  if (!options.fresh && existsSync(cacheFile)) {
    const cached = readFileSync(cacheFile, 'utf8')
    const endpoint =
      mode === 'better-auth' ? '/api/auth/get-session' : '/api/auth/session'
    const response = await fetch(`${context.api}${endpoint}`, {
      headers: { ...headers, Cookie: cached },
    })
    expect(response.status).toBe(200)
    const session = await response.json()
    // Reuse only cookies still accepted by the real engine. Revocation tests
    // invalidate this cache naturally; never forge sessions or reset budgets.
    if (session?.user?.id === user.id) return cached
  }
  const remember = (jar: string) => {
    writeFileSync(cacheFile, jar, { mode: 0o600 })
    return jar
  }
  if (mode === 'better-auth') {
    const response = await fetch(`${context.api}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        ...headers,
        Origin: edge['x-platform-origin']!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user.email, password: user.password }),
      redirect: 'manual',
    })
    expect(response.status).toBe(200)
    const sessionCookie = response.headers
      .getSetCookie()
      .find((entry) => entry.startsWith('__Host-locadora.session_token='))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toMatch(/; Secure(?:;|$)/i)
    expect(sessionCookie).toMatch(/; HttpOnly(?:;|$)/i)
    expect(sessionCookie).toMatch(/; Path=\/(?:;|$)/i)
    expect(sessionCookie).not.toMatch(/; Domain=/i)
    const jar = sessionCookies(response)
    expect(jar).toContain('__Host-locadora.session_token=')
    return remember(jar)
  }
  const csrf = await fetch(`${context.api}/api/auth/csrf`, { headers })
  expect(csrf.status).toBe(200)
  const { csrfToken } = (await csrf.json()) as { csrfToken: string }
  const response = await fetch(`${context.api}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      ...headers,
      Cookie: sessionCookies(csrf),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      csrfToken,
      email: user.email,
      password: user.password,
      callbackUrl: context.api,
      json: 'true',
    }),
    redirect: 'manual',
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { url: string }
  expect(new URL(body.url).searchParams.has('error')).toBe(false)
  const jar = sessionCookies(response)
  expect(jar).toContain('next-auth.session-token=')
  return remember(jar)
}
