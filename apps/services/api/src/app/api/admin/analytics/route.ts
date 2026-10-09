export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Aposentada: expunha métricas globais do processo (sem tenantId) a qualquer
 * ADMIN de qualquer locadora, e o produtor (lib/api-instrumentation.ts) não
 * tinha importadores. Nenhuma tela consome esta rota.
 */
export function GET() {
  return Response.json({ error: 'Endpoint retired' }, { status: 410 })
}
