import { downloadQuoteDocument } from '../../../../../../../host/documents'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => downloadQuoteDocument(request, (await params).id, 'admin', true)
