import { ContatoPage } from "@gb-locacoes/frontend/pages/contato";
import { metadataDaVitrine } from "../seo";

interface Props {
  params: Promise<{ locadora: string }>;
}

// SEO da própria locadora (onda 135, A4).
export async function generateMetadata(props: Props) {
  return metadataDaVitrine((await props.params).locadora, "contato");
}

export default function Page() {
  return <ContatoPage />;
}
