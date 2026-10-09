export function planTenantMaintenance(
  args: string[],
  env: NodeJS.ProcessEnv,
  operation: string
) {
  let tenantId: string | undefined
  let apply = false
  let confirmed = false
  let confirmedDatabase: string | undefined
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!
    if (arg === '--tenant-id') tenantId = args[++i]
    else if (arg.startsWith('--tenant-id='))
      tenantId = arg.slice('--tenant-id='.length)
    else if (arg === '--apply') apply = true
    else if (arg === `--confirm=${operation}`) confirmed = true
    else if (arg.startsWith('--confirm-database='))
      confirmedDatabase = arg.slice('--confirm-database='.length)
    else throw new Error('Argumento desconhecido')
  }
  if (!tenantId?.trim() || tenantId.startsWith('--'))
    throw new Error('--tenant-id é obrigatório; tenants não são inferidos')
  const connectionString = env.DATABASE_URL
  if (!connectionString)
    throw new Error(
      'DATABASE_URL explícita é obrigatória; arquivos dotenv não são carregados'
    )
  let target: URL
  try {
    target = new URL(connectionString)
  } catch {
    throw new Error('DATABASE_URL inválida')
  }
  const database = decodeURIComponent(target.pathname.slice(1))
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^test(?:[_-].+)?$/.test(database)
  )
    throw new Error(
      'Backfill só é permitido em PostgreSQL local de testes (test ou test_*)'
    )
  if (
    apply &&
    (!confirmed ||
      confirmedDatabase !== database ||
      env.TEST_DATABASE_DISPOSABLE !== 'true')
  )
    throw new Error(
      `--apply requer --confirm=${operation}, --confirm-database=<nome> e TEST_DATABASE_DISPOSABLE=true`
    )
  return { tenantId: tenantId.trim(), apply, connectionString }
}
