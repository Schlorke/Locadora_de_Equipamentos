import { after } from 'next/server'
import { createCredentialAccounts } from '@gb-locacoes/backend/identity'
import { createCredentialAccountHandlers } from '@gb-locacoes/backend/http'
import {
  createResendClient,
  createOwnerAccountRuntime,
  getDatabaseRuntime,
} from '@gb-locacoes/backend/runtime'
import {
  getIdentity,
  handleIdentityRequest,
  findAccountsByEmail,
  consumeAccountNotice,
  resetAuthAccountAttempts,
  refuseAuthAttempt,
} from './session'
const accounts = createCredentialAccounts({
  database: () => getDatabaseRuntime().prisma,
  getIdentity,
  findAccountsByEmail,
  resend: createResendClient(process.env.RESEND_API_KEY),
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
  database: () => getDatabaseRuntime().prisma,
  accounts,
  refuseAuthAttempt,
  consumeAccountNotice,
})
