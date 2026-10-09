import { NextResponse } from 'next/server'
const setZohoStateCookie: Parameters<
  typeof createZohoOAuthAuthorizer
>[0]['setStateCookie'] = (response, name, value, options) => {
  const result = new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  })
  result.cookies.set(name, value, options)
  return result
}

import { cookies } from 'next/headers'
import { createZohoMailClient } from '@gb-locacoes/backend/communications'
import {
  createZohoOAuthAuthorizer,
  createZohoOAuthCallback,
  createZohoOAuthDisconnect,
} from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant-transaction'
const client = createZohoMailClient(),
  getEnv = () => process.env
export const { authorizeZohoOAuth } = createZohoOAuthAuthorizer({
  withTenantTransaction,
  ...client,
  getEnv,
  setStateCookie: setZohoStateCookie,
})
export const { completeZohoOAuth } = createZohoOAuthCallback({
  withTenantTransaction,
  ...client,
  getEnv,
  cookies,
})
export const { disconnectZohoOAuth } = createZohoOAuthDisconnect({
  withTenantTransaction,
})
