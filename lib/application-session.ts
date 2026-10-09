import {
  getServerSession as getLegacySession,
  type NextAuthOptions,
  type Session,
} from 'next-auth'
import { headers } from 'next/headers'
import {
  createApplicationSessionReader,
  identityAuthenticationTime,
} from '@gb-locacoes/backend/identity'
import { authOptions } from '@/lib/auth'
import { getIdentity, identityEnabled, identityMode } from '@/lib/identity'

const readSession = createApplicationSessionReader<Session, NextAuthOptions>({
  mode: () => identityMode(process.env),
  identityEnabled: () => identityEnabled(process.env),
  identity: async () => {
    const session = await (
      await getIdentity()
    ).api.getSession({ headers: await headers() })
    if (!session) return null
    const authenticatedAt = identityAuthenticationTime(
      session.session.createdAt
    )
    return {
      ...(authenticatedAt === undefined ? {} : { authenticatedAt }),
      expires: session.session.expiresAt.toISOString(),
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        role: session.user.role,
      },
    }
  },
  legacy: (options) => getLegacySession(options || authOptions),
})

export async function getServerSession(
  options?: NextAuthOptions
): Promise<Session | null> {
  return readSession(options)
}
