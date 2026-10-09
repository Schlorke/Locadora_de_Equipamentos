export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Aposentada: expunha eventos de segurança globais do processo (IPs, user
 * agents, endpoints, sem tenantId) a qualquer ADMIN de qualquer locadora, e
 * recordSecurityEvents não tinha chamadores. Nenhuma tela consome esta rota.
 */
export function GET() {
  return Response.json({ error: 'Endpoint retired' }, { status: 410 })
}
