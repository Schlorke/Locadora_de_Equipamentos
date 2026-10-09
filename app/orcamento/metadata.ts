import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Solicitar Orçamento - GB Locações',
  description:
    'Solicite seu orçamento de locação de equipamentos para construção civil. Preços competitivos, entrega rápida em Porto Alegre e região metropolitana. Resposta em até 24 horas!',
  keywords: [
    'orçamento locação equipamentos',
    'solicitar orçamento GB Locações',
    'preço aluguel equipamentos',
    'orçamento andaimes Porto Alegre',
    'cotação equipamentos construção',
    'aluguel equipamentos preço',
    'locação equipamentos orçamento',
  ],
  openGraph: {
    title: 'Solicitar Orçamento - GB Locações',
    description:
      'Solicite seu orçamento de locação de equipamentos. Preços competitivos e entrega rápida em Porto Alegre.',
    url: 'https://locacoesgb.com.br/orcamento',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Solicitar Orçamento',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solicitar Orçamento - GB Locações',
    description:
      'Solicite seu orçamento de locação de equipamentos. Preços competitivos em Porto Alegre.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/orcamento',
  },
}
