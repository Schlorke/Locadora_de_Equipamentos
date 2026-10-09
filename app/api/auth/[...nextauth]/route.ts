import NextAuth from 'next-auth'
import { authOptions, withSignInAvailability } from '@/lib/auth'
import { handleIdentityRequest, identityMode } from '@/lib/identity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// Login legado que não pôde ser contado nem conferido: 503 com Retry-After e no-store, nunca o 401 de senha errada.
const legacyHandler = withSignInAvailability(NextAuth(authOptions))

async function handler(
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  if (identityMode(process.env) === 'better-auth')
    return handleIdentityRequest(request)
  return legacyHandler(request, context)
}

export { handler as GET, handler as POST }
