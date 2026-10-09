import { NextRequest, NextResponse } from 'next/server'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { credentialAccountHandlers } from '@/lib/credential-accounts'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin) return crossOrigin
  if (process.env.AUTH_CREDENTIAL_WRITES_PAUSED === 'true')
    return NextResponse.json(
      { error: 'Credential maintenance in progress' },
      { status: 503 }
    )
  return credentialAccountHandlers.register(request)
}
