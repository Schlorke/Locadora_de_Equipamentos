import {
  SessionProviderWrapper,
  SEOSchemas,
  defaultFAQItems,
} from '@gb-locacoes/frontend/app'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import type { Metadata, Viewport } from 'next'
import { Inter, Jost } from 'next/font/google'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import React from 'react'
import ClientLayout from './ClientLayout'
import './globals.css'

// 🚀 Lazy load de Analytics e SpeedInsights para reduzir bundle inicial e TBT
// Carregam após a página estar interativa, melhorando métricas de performance
// Nota: No Next.js 16 com Turbopack, ssr: false não é necessário - gerenciado automaticamente
const Analytics = dynamic(() =>
  import('@vercel/analytics/next').then((mod) => ({
    default: mod.Analytics,
  }))
)
const SpeedInsights = dynamic(() =>
  import('@vercel/speed-insights/next').then((mod) => ({
    default: mod.SpeedInsights,
  }))
)

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
})

const jost = Jost({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jost',
  preload: false, // evita warning "preloaded but not used" (fonte de títulos carrega sob demanda)
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: false,
})

// Viewport e theme-color para iOS/Android status bar
// No Next.js 14+ o themeColor é exportado via viewport, não via metadata.other
export const viewport: Viewport = {
  themeColor: '#ffffff',
  viewportFit: 'cover',
}

// Gerar metadados dinâmicos a partir do banco de dados
export async function generateMetadata(): Promise<Metadata> {
  // Valores padrão caso não existam no banco ou durante CI build
  const defaultAboutUs =
    'Locação de equipamentos para construção civil em Porto Alegre e região. Segurança, qualidade e manutenção constante.'
  const defaultTitle =
    'GB Locações - Especializada em Locação de Equipamentos para Construção Civil'

  let settings = null
  try {
    // Buscar configurações do banco (pode falhar no CI)
    settings = await prisma.setting.findFirst({
      select: {
        aboutUsText: true,
        seoTitle: true,
        seoDescription: true,
      },
    })
  } catch (_error) {
    // Ignorar erro durante build no CI
    console.log('Using default metadata (database not available)')
  }

  const description = settings?.aboutUsText || defaultAboutUs
  const title = settings?.seoTitle || defaultTitle

  return {
    metadataBase: new URL('https://locacoesgb.com.br'),
    title: {
      default: title,
      template: '%s | GB Locações',
    },
    description: description,
    keywords: [
      'locação de equipamentos para construção civil',
      'aluguel de equipamentos para obras',
      'locação de equipamentos Porto Alegre',
      'andaime suspenso',
      'andaimes suspensos Porto Alegre',
      'aluguel de andaime',
      'betoneira locação',
      'aluguel de betoneira Porto Alegre',
      'compressor de ar para construção',
      'cadeira para pintura',
      'cadeira elétrica para fachada',
      'equipamentos para construção civil Porto Alegre',
      'serviços em altura',
      'equipamentos para obras',
      'GB Locações',
      'locação equipamentos região metropolitana Porto Alegre',
    ],
    authors: [{ name: 'GB Locações' }],
    creator: 'GB Locações',
    publisher: 'GB Locações',
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      shortcut: '/favicon.ico',
      apple: '/favicon.svg',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      url: 'https://locacoesgb.com.br',
      siteName: 'GB Locações',
      title: title,
      description: description,
      images: [
        {
          url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
          width: 1200,
          height: 630,
          alt: 'GB Locações - Locação de Equipamentos para Construção Civil',
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [
        {
          url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
          alt: 'GB Locações - Locação de Equipamentos para Construção Civil',
        },
      ],
      creator: '@locacoesgb',
      site: '@locacoesgb',
    },
    // Verificação de domínio: use variáveis de ambiente (nunca commitar tokens reais). Ver docs/guides/google-indexing-seo.md
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION && {
        google: process.env.GOOGLE_SITE_VERIFICATION,
      }),
    },
    generator: 'v0.dev',
    other: {
      // Facebook App ID para Open Graph (necessário para o Facebook Sharing Debugger e Login)
      ...(process.env.FACEBOOK_CLIENT_ID && {
        'fb:app_id': process.env.FACEBOOK_CLIENT_ID,
      }),
      // Verificação de domínio no Facebook Business Manager (Meta); valor via FACEBOOK_DOMAIN_VERIFICATION
      ...(process.env.FACEBOOK_DOMAIN_VERIFICATION && {
        'facebook-domain-verification':
          process.env.FACEBOOK_DOMAIN_VERIFICATION,
      }),
      // Geo/SEO local: região, cidade e coordenadas (ICBM) para buscadores e ferramentas
      'geo.region': 'BR-RS',
      'geo.placename': 'Porto Alegre',
      icbm: '-29.9943488, -51.1975239',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-capable': 'yes', // Mantido para compatibilidade com iOS antigo
      'mobile-web-app-capable': 'yes', // Padrão atual (apple-mobile-web-app-capable deprecated)
      // Meta tags específicas do LinkedIn para garantir compatibilidade
      'og:image:secure_url': 'https://locacoesgb.com.br/gb-locacoes-og.png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
    },
  }
}

// Google Analytics: use variável de ambiente ou ID padrão da GB Locações
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-5S49T61C7N'
// Google Ads (conversões/remarketing): ID da conta Ads (prefixo AW-)
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || 'AW-17933178077'
const HAS_GTAG = Boolean(GA_MEASUREMENT_ID || GOOGLE_ADS_ID)

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jost.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* SEO Schemas: Organization, WebSite com SearchAction, Service, FAQ */}
        <SEOSchemas includeFAQ={true} faqItems={defaultFAQItems} />
        {/* Google tag (gtag.js): GA4 + Google Ads no head. URL com AW- para o teste de conexão do Google Ads detectar */}
        {HAS_GTAG && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID || GA_MEASUREMENT_ID}`}
              strategy="beforeInteractive"
            />
            <Script id="gtag-init" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}');` : ''}
                ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
              `}
            </Script>
          </>
        )}
      </head>
      <body
        className="min-h-screen bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        <SessionProviderWrapper session={session}>
          <ClientLayout>
            {children}
            <SpeedInsights />
            <Analytics />
          </ClientLayout>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
