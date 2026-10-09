/**
 * Relative aliases (Turbopack on Windows rejects absolute `C:\...` resolveAlias
 * targets: "windows imports are not implemented yet").
 * Also declared as workspace:* in root package.json; junctions under
 * node_modules/@gb-locacoes resolve package exports when linked.
 */
const workspacePackageAliases = {
  '@gb-locacoes/frontend/app': './packages/frontend/src/app/index.web.ts',
  '@gb-locacoes/frontend/pages': './packages/frontend/src/pages',
  '@gb-locacoes/ui': './packages/ui/src/index.web.ts',
  '@gb-locacoes/design-tokens': './packages/design-tokens/src/index.ts',
}

/** @type {import('next').NextConfig} */
const remotePatterns = [
  {
    protocol: 'https',
    hostname: 'via.placeholder.com',
  },
  {
    protocol: 'https',
    hostname: 'images.unsplash.com',
  },
  {
    protocol: 'https',
    hostname: 'picsum.photos',
  },
]

// Allow Supabase storage (e.g., https://<project>.supabase.co/storage/v1/object/public/...)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl)
    remotePatterns.push({
      protocol: 'https',
      hostname,
    })
  } catch {
    // ignore invalid URL, keep defaults
  }
}

const nextConfig = {
  transpilePackages: ['@gb-locacoes/frontend', '@gb-locacoes/ui', '@gb-locacoes/design-tokens'],
  // Pacotes Node.js que não devem ser bundled (usam fs, stream, crypto etc.)
  serverExternalPackages: ['pdfkit'],
  // Evita geração de routes.d.ts que pode falhar no type-check (TS1160/TS1109 em CI)
  typedRoutes: false,
  images: {
    unoptimized: true,
    remotePatterns,
  },
  env: {},
  // 🚀 Otimizações de Performance - Redução de JavaScript Bundle
  compiler: {
    // Remove console.log em produção (reduz bundle size)
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'], // Mantém erros e warnings
          }
        : false,
  },
  // Reduz uso de memória no build (evita OOM no GitHub Actions - 7GB RAM)
  productionBrowserSourceMaps: false,
  // Otimizações experimentais para reduzir bundle size e TBT
  experimental: {
    // Desativa source maps do servidor em CI para reduzir memória
    ...(process.env.CI ? { serverSourceMaps: false } : {}),
    // Otimiza imports de bibliotecas grandes automaticamente (tree-shaking agressivo)
    optimizePackageImports: [
      'framer-motion',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'lucide-react',
      'date-fns',
      'recharts',
      '@react-three/fiber',
      '@react-three/drei',
      'three',
      'gsap',
    ],
    // Melhora o tree shaking de módulos ES
    optimizeServerReact: true,
    // Otimizações adicionais de performance
    webVitalsAttribution: ['CLS', 'LCP'],
  },
  // Configurações de compressão
  compress: true,
  // Turbopack configuration (Next.js 16 usa Turbopack por padrão)
  turbopack: {
    resolveAlias: workspacePackageAliases,
  },
}

export default nextConfig
