import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso e Condições - GB Locações',
  description:
    'Termos de Uso e Condições de Locação da GB Locações. Conheça as regras para aluguel de equipamentos, política de cancelamento e devolução.',
  keywords: [
    'termos de uso',
    'condições de locação',
    'aluguel equipamentos termos',
    'política de cancelamento',
    'devolução equipamentos',
    'GB Locações termos',
    'contrato locação',
  ],
  openGraph: {
    title: 'Termos de Uso e Condições - GB Locações',
    description:
      'Termos de Uso e Condições de Locação da GB Locações. Política de cancelamento e devolução.',
    url: 'https://locacoesgb.com.br/termos',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Termos de Uso',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Termos de Uso e Condições - GB Locações',
    description:
      'Termos de Uso e Condições de Locação da GB Locações. Política de cancelamento e devolução.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/termos',
  },
  robots: {
    index: true,
    follow: true,
  },
}
