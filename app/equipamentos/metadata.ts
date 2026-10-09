import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catálogo de Equipamentos para Locação - GB Locações',
  description:
    'Confira nosso catálogo completo de equipamentos para locação: andaimes suspensos, betoneiras, compressores, cadeiras elétricas e mais. Aluguel em Porto Alegre e região metropolitana.',
  keywords: [
    'catálogo equipamentos locação',
    'aluguel andaimes Porto Alegre',
    'locação betoneira',
    'aluguel compressor',
    'cadeira elétrica locação',
    'equipamentos construção civil',
    'locação equipamentos obras',
    'aluguel equipamentos RS',
    'GB Locações equipamentos',
  ],
  openGraph: {
    title: 'Catálogo de Equipamentos para Locação - GB Locações',
    description:
      'Confira nosso catálogo completo de equipamentos para locação em Porto Alegre e região.',
    url: 'https://locacoesgb.com.br/equipamentos',
    type: 'website',
    images: [
      {
        url: 'https://locacoesgb.com.br/gb-locacoes-og.png',
        width: 1200,
        height: 630,
        alt: 'GB Locações - Catálogo de Equipamentos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Catálogo de Equipamentos para Locação - GB Locações',
    description:
      'Confira nosso catálogo completo de equipamentos para locação em Porto Alegre e região.',
  },
  alternates: {
    canonical: 'https://locacoesgb.com.br/equipamentos',
  },
}
