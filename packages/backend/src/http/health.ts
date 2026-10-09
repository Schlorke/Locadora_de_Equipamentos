/** Contrato de readiness legado, sem dependência do framework ou de um singleton. */
export function createHealthHandler(checkDatabase: () => Promise<unknown>) {
  return async function GET(): Promise<Response> {
    try {
      await checkDatabase()
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      })
    } catch (error) {
      console.error('[health] database check failed', {
        event: 'health.database_unavailable',
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      return Response.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: 'Service unavailable',
        },
        { status: 503 }
      )
    }
  }
}
