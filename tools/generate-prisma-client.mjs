import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Generation reads the schema, not the database. Do not require application secrets for installation.
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'generate', '--generator', 'client'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured' },
})
if (result.error) { process.stderr.write('Prisma Client generation could not start.\n'); process.exit(1) }
process.exit(result.status ?? 1)
