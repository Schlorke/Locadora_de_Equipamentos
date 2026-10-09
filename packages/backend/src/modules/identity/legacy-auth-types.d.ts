import type { DefaultSession, DefaultUser } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

type Role = 'ADMIN' | 'FINANCIAL' | 'OPERATOR' | 'CLIENT'

declare module 'next-auth' {
  interface Session {
    authenticatedAt?: number
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    authenticatedAt?: number
    id: string
    role: Role
  }
}
