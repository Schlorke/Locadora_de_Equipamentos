/** Private transport for the host-scoped membership, including failures. */
export function organizationCurrentResponse(
  body: unknown,
  status = 200
): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
  })
}
