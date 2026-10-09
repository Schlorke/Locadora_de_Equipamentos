import { uploadImage } from '../../../host/branding'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../host/private-identity'
import { InvalidImageError } from '@gb-locacoes/backend/catalog'

export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    return await uploadImage(principal, request)
  } catch (error) {
    if (error instanceof InvalidImageError)
      return NextResponse.json({ error: error.message }, { status: 400 })
    console.error(
      'Image upload failed',
      error instanceof Error ? error.name : 'UnknownError'
    )
    return NextResponse.json(
      { error: 'Erro ao fazer upload da imagem' },
      { status: 500 }
    )
  }
}
