import { NextRequest, NextResponse } from 'next/server'

import { credentialAccountHandlers } from '@/lib/credential-accounts'

export async function GET(request: NextRequest) {
  if (process.env.AUTH_CREDENTIAL_WRITES_PAUSED === 'true')
    return NextResponse.json(
      { error: 'Credential maintenance in progress' },
      { status: 503 }
    )
  return credentialAccountHandlers.verifyEmail(request)
}
