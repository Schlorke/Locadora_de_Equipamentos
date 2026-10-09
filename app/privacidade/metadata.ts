import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade - GB Locações',
  description:
    'Política de Privacidade da GB Locações. Saiba como coletamos, usamos e protegemos seus dados pessoais em conformidade com a LGPD.',
  keywords: [
    'política de privacidade',
    'LGPD',
    'proteção de dados',
    'GB Locações privacidade',
    'dados pessoais',
    'segurança de dados',
  ],
  openGraph: {
    title: 'Política de Privacidade - GB Locações',
    description:
      'Política de Privacidade da GB Locações. Saiba como protegemos seus dados pessoais.',
    url: 'https://locacoesgb.com.br/privacidade',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Política de Privacidade',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Política de Privacidade - GB Locações',
    description:
      'Política de Privacidade da GB Locações. Saiba como protegemos seus dados pessoais.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/privacidade',
  },
  robots: {
    index: true,
    follow: true,
  },
}
