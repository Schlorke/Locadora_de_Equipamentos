import { QuotePageWrapper } from "@gb-locacoes/frontend/pages/orcamento";
import { metadataDaVitrine } from "../seo";

interface Props {
  params: Promise<{ locadora: string }>;
}

// SEO da própria locadora (onda 135, A4).
export async function generateMetadata(props: Props) {
  return metadataDaVitrine((await props.params).locadora, "orcamento");
}

export default function Page() {
  return <QuotePageWrapper />;
}
