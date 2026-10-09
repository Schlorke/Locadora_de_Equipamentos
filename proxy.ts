import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getIdentity, identityEnabled, identityMode } from '@/lib/identity'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname === '/admin/login') return NextResponse.next()
  if (pathname.startsWith('/debug') && process.env.NODE_ENV === 'development')
    return NextResponse.next()
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const mode = identityMode(process.env)
  let authenticated = false
  if (identityEnabled(process.env)) {
    try {
      authenticated = Boolean(
        await (await getIdentity()).api.getSession({ headers: request.headers })
      )
    } catch {
      authenticated = false
    }
  }
  if (!authenticated && mode === 'legacy')
    authenticated = Boolean(await getToken({ req: request }))
  if (authenticated) return NextResponse.next()
  const login = new URL('/admin/login', request.url)
  login.searchParams.set(
    'callbackUrl',
    request.nextUrl.pathname + request.nextUrl.search
  )
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/admin/:path*', '/debug/:path*'] }
