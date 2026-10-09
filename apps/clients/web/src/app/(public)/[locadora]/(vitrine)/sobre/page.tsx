import { metadataDaVitrine } from '../seo'
import { SobreDaVitrine } from './SobreDaVitrine'

interface Props {
  params: Promise<{ locadora: string }>
}

// SEO da própria locadora (onda 135, A4): título, descrição, canonical e Open Graph na origem dela.
export async function generateMetadata({ params }: Props) {
  return metadataDaVitrine((await params).locadora, 'sobre')
}

export default function Page() {
  return <SobreDaVitrine />
}
