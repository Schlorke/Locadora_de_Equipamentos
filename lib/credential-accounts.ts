import { after } from 'next/server'
import { createCredentialAccounts } from '@gb-locacoes/backend/identity'
import { createCredentialAccountHandlers } from '@gb-locacoes/backend/http'
import { createOwnerAccountRuntime } from '@gb-locacoes/backend/runtime'
import { prisma } from './prisma'
import { getIdentity, handleIdentityRequest } from './identity'
import { findAccountsByEmail } from './auth'
import getResend from './resend'
import {
  consumeAccountNotice,
  resetAuthAccountAttempts,
  refuseAuthAttempt,
} from './rate-limit'
const accounts = createCredentialAccounts({
  database: () => prisma,
  getIdentity,
  findAccountsByEmail,
  resend: getResend(),
  after,
  consumeAccountNotice,
  resetAuthAccountAttempts,
})
export const credentialAccountHandlers = createCredentialAccountHandlers({
  accounts,
  refuseAuthAttempt,
  handleIdentityRequest,
})
export const ownerAccountHandlers = createOwnerAccountRuntime({
  database: () => prisma,
  accounts,
  refuseAuthAttempt,
  consumeAccountNotice,
})
