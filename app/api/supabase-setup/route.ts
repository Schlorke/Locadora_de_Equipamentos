export function POST() {
  return Response.json({ error: 'Endpoint retired' }, { status: 410 })
}

export function GET() {
  return Response.json({ error: 'Endpoint retired' }, { status: 410 })
}
