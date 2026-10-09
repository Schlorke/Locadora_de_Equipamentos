import { downloadQuoteDocument } from '@/lib/quote-document'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => downloadQuoteDocument(request, (await params).id, 'admin', false)
