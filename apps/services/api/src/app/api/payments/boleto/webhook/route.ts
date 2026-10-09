export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export function POST() {
  return Response.json(
    { error: 'Integration-specific webhook URL required' },
    { status: 410 }
  )
}
