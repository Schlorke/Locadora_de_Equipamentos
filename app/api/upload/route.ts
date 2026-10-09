import { uploadImage } from '@/lib/image-upload-handler'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { InvalidImageError } from '@/lib/image-upload'

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
