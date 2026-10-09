import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre a GB Locações - Nossa História e Valores',
  description:
    'Conheça a GB Locações: mais de 10 anos de experiência em locação de equipamentos para construção civil em Porto Alegre e região. Qualidade, pontualidade e atendimento especializado.',
  keywords: [
    'sobre GB Locações',
    'história GB Locações',
    'empresa locação equipamentos Porto Alegre',
    'aluguel equipamentos construção civil',
    'locadora equipamentos RS',
    'GB Locações Porto Alegre',
    'equipamentos para obras',
    'locação andaimes Porto Alegre',
  ],
  openGraph: {
    title: 'Sobre a GB Locações - Nossa História e Valores',
    description:
      'Mais de 10 anos de experiência em locação de equipamentos para construção civil em Porto Alegre e região.',
    url: 'https://locacoesgb.com.br/sobre',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Sobre Nós',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre a GB Locações - Nossa História e Valores',
    description:
      'Mais de 10 anos de experiência em locação de equipamentos para construção civil em Porto Alegre.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/sobre',
  },
}
