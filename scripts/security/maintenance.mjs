import { pathToFileURL, URL } from 'node:url'
import process from 'node:process'
import console from 'node:console'

const operations = ['provision-admin', 'setup-storage']
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function planMaintenance(args, env) {
  const [operation, ...flags] = args
  if (!operations.includes(operation))
    throw new Error('Use provision-admin or setup-storage')
  if (
    flags.some(
      (flag) =>
        !['--apply', '--allow-remote', `--confirm=${operation}`].includes(flag)
    )
  ) {
    throw new Error('Unknown maintenance argument')
  }
  const apply = flags.includes('--apply')
  if (apply && !flags.includes(`--confirm=${operation}`)) {
    throw new Error('Applying requires explicit operation confirmation')
  }
  const endpoint =
    operation === 'provision-admin'
      ? env.DATABASE_URL
      : env.NEXT_PUBLIC_SUPABASE_URL
  let target
  try {
    target = new URL(endpoint)
  } catch {
    throw new Error('A valid target URL is required')
  }
  const protocols =
    operation === 'provision-admin'
      ? ['postgres:', 'postgresql:']
      : ['http:', 'https:']
  if (!protocols.includes(target.protocol))
    throw new Error('Invalid target protocol')
  const remote = !loopbackHosts.has(target.hostname)
  if (apply && remote && !flags.includes('--allow-remote'))
    throw new Error('Remote target requires --allow-remote')
  if (remote && operation === 'setup-storage' && target.protocol !== 'https:')
    throw new Error('Remote storage requires HTTPS')
  if (operation === 'provision-admin') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BOOTSTRAP_ADMIN_EMAIL || ''))
      throw new Error('BOOTSTRAP_ADMIN_EMAIL is required')
    if ((env.BOOTSTRAP_ADMIN_PASSWORD || '').length < 12)
      throw new Error(
        'BOOTSTRAP_ADMIN_PASSWORD must have at least 12 characters'
      )
  } else if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }
  return { operation, apply, target: remote ? 'remote' : 'loopback' }
}

async function provisionAdmin(env) {
  const [{ PrismaPg }, { PrismaClient }, { default: bcrypt }] =
    await Promise.all([
      import('@prisma/adapter-pg'),
      import('@prisma/client'),
      import('bcryptjs'),
    ])
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  })
  try {
    const email = env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase()
    // Igualdade exata com os dois lados normalizados (trim + minúsculas).
    // `mode: 'insensitive'` vira ILIKE, em que `_` e `%` são curingas.
    const existing = await prisma.$queryRaw`
      SELECT id FROM users WHERE lower(btrim(email)) = ${email} LIMIT 1`
    if (existing.length > 0)
      throw new Error('Existing account cannot be changed by bootstrap')
    await prisma.user.create({
      data: {
        email,
        name: env.BOOTSTRAP_ADMIN_NAME || 'Admin',
        role: 'ADMIN',
        password: await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12),
        emailVerified: new Date(),
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function setupStorage(env) {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
  const { data, error } = await client.storage.listBuckets()
  if (error) throw new Error('Storage inspection failed')
  if (data.some((bucket) => bucket.name === 'gb-locacoes-images')) return
  const result = await client.storage.createBucket('gb-locacoes-images', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })
  if (result.error) throw new Error('Storage provisioning failed')
}

export async function runMaintenance(args, env, operationsOverride) {
  const plan = planMaintenance(args, env)
  if (!plan.apply) return plan
  const handlers = operationsOverride || {
    'provision-admin': provisionAdmin,
    'setup-storage': setupStorage,
  }
  await handlers[plan.operation](env)
  return plan
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await runMaintenance(process.argv.slice(2), process.env)
    console.log(
      JSON.stringify({
        ...result,
        result: result.apply ? 'completed' : 'dry-run',
      })
    )
  } catch {
    console.error(
      'Maintenance failed. Check arguments, explicit confirmation, target and required environment variables. No credentials are logged.'
    )
    process.exitCode = 1
  }
}
