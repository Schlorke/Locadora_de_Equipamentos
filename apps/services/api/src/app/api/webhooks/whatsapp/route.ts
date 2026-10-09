export function POST() {
  return Response.json(
    { error: 'Integration-specific webhook URL required' },
    { status: 410 }
  )
}
export function GET() {
  return Response.json(
    { error: 'Integration-specific webhook URL required' },
    { status: 410 }
  )
}
