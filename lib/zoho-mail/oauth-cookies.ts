import type { createZohoOAuthAuthorizer } from '@gb-locacoes/backend/http'
import { NextResponse } from 'next/server'
export const setZohoStateCookie: Parameters<
  typeof createZohoOAuthAuthorizer
>[0]['setStateCookie'] = (response, name, value, options) => {
  const result = new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  })
  result.cookies.set(name, value, options)
  return result
}
