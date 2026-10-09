import path from 'node:path'

const workspaceRoot = path.join(import.meta.dirname, '..', '..', '..')

/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  serverExternalPackages: ['pdfkit', 'exceljs'],
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  transpilePackages: [
    '@gb-locacoes/backend',
    '@gb-locacoes/contracts',
    '@gb-locacoes/domain',
  ],
}

export default config
