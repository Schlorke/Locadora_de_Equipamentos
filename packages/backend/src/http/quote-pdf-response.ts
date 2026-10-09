export function quotePdfResponse(
  buffer: Buffer,
  title: string,
  identifier: string
) {
  const safeId = identifier.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'attachment; filename="' + title + '-' + safeId + '.pdf"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
