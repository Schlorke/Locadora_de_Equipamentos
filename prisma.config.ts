import 'dotenv/config'

import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // A CLI lê DATABASE_URL; DIRECT_URL sozinha não muda este datasource.
    // O executor deve selecionar explicitamente o alvo e o papel apropriado para migrations.
  },
})
