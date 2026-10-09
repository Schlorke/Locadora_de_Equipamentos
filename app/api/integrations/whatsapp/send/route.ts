import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { sendTextRequest } from '@/lib/whatsapp-write'
export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    if (access.principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return await sendTextRequest(access.principal, request)
  } catch (error) {
    const unavailable =
      error instanceof Error &&
      /(?:INTEGRATION|CREDENTIAL)_UNAVAILABLE/.test(error.message)
    return NextResponse.json(
      {
        error: unavailable
          ? 'Integração WhatsApp da locadora indisponível'
          : 'Envio não confirmado; confira o histórico antes de reenviar',
      },
      { status: unavailable ? 503 : 502 }
    )
  }
}
