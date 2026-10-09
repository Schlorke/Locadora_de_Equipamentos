export function POST() {
  return Response.json({ error: 'Endpoint retired' }, { status: 410 })
}
