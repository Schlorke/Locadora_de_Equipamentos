import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Devolução - GB Locações',
  description:
    'Política de devolução de equipamentos da GB Locações. Saiba como devolver equipamentos alugados, prazos, condições e procedimentos.',
  keywords: [
    'política de devolução',
    'devolução equipamentos',
    'locação equipamentos devolução',
    'prazo devolução',
    'GB Locações devolução',
    'devolução aluguel equipamentos',
  ],
  openGraph: {
    title: 'Política de Devolução - GB Locações',
    description:
      'Política de devolução de equipamentos da GB Locações. Prazos, condições e procedimentos.',
    url: 'https://locacoesgb.com.br/politica-devolucao',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Política de Devolução',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Política de Devolução - GB Locações',
    description:
      'Política de devolução de equipamentos da GB Locações. Prazos, condições e procedimentos.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/politica-devolucao',
  },
  robots: {
    index: true,
    follow: true,
  },
}
