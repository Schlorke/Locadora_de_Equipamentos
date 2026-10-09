import { metadataDaVitrine } from "../seo";
import { CatalogoDaVitrine } from "./CatalogoDaVitrine";

interface Props {
  params: Promise<{ locadora: string }>;
}

// SEO da própria locadora (onda 135, A4): título, descrição, canonical e Open Graph na origem dela. A página continua a
// do catálogo de cliente (CatalogoDaVitrine).
export async function generateMetadata(props: Props) {
  return metadataDaVitrine((await props.params).locadora, "equipamentos");
}

export default function Page() {
  return <CatalogoDaVitrine />;
}
