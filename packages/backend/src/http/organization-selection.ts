/** Shared transport only; identity owns preference and membership validation. */
export function organizationSelectionResponse(
  body: unknown,
  status = 200,
  cookie?: string
): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Cookie, x-tenant-id',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  })
}
