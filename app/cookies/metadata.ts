import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Cookies - GB Locações',
  description:
    'Política de Cookies da GB Locações. Entenda como utilizamos cookies para melhorar sua experiência de navegação em nosso site.',
  keywords: [
    'política de cookies',
    'cookies',
    'LGPD',
    'GB Locações cookies',
    'privacidade online',
    'rastreamento web',
  ],
  openGraph: {
    title: 'Política de Cookies - GB Locações',
    description:
      'Política de Cookies da GB Locações. Entenda como utilizamos cookies em nosso site.',
    url: 'https://locacoesgb.com.br/cookies',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Política de Cookies',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Política de Cookies - GB Locações',
    description:
      'Política de Cookies da GB Locações. Entenda como utilizamos cookies em nosso site.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/cookies',
  },
  robots: {
    index: true,
    follow: true,
  },
}
