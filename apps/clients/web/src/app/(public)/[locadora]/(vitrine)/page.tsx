import {
  HomePage,
  buildHeroInitialSettings,
  getLocalBusinessData,
} from "@gb-locacoes/frontend/pages/home";
import {
  getPublicCategoryNames,
  getPublicSettings,
} from "../../../../host/server/public-api";
import { getLojaDaVitrine } from "./loja";
import { metadataDaVitrine } from "./seo";

interface Props {
  params: Promise<{ locadora: string }>;
}

// SEO da própria locadora (onda 135, A4): título e descrição do painel, canonical e Open Graph na origem dela.
export async function generateMetadata(props: Props) {
  return metadataDaVitrine((await props.params).locadora, "inicio");
}

export default async function Page(props: Props) {
  const { locadora } = await props.params;
  // Sem configuração publicada (ou backend indisponível) o LocalBusiness fica só com o que a locadora tem: nome e
  // origem do cartão dela, nunca dados padrão de outra locadora (T12). Onda 134: o local, o horário e as categorias
  // reais da própria locadora entram no JSON-LD; os anos, a frota, o telefone e o WhatsApp dela vão ao hero já no SSR
  // (com o recorte inicial o hero não consulta a API).
  const [publicSettings, loja, categorias] = await Promise.all([
    getPublicSettings(locadora),
    getLojaDaVitrine(locadora),
    getPublicCategoryNames(locadora),
  ]);

  const localBusiness = getLocalBusinessData(
    publicSettings,
    loja && {
      name: loja.name,
      url: loja.origin,
      city: loja.city,
      state: loja.state,
      logoUrl: loja.logoUrl,
    },
    categorias,
  );
  const heroInitialSettings = buildHeroInitialSettings({
    heroCarousel: publicSettings?.heroCarousel,
    waveAnimation: publicSettings?.waveAnimation,
    siteContent: publicSettings?.siteContent,
    companyPhone: publicSettings?.companyPhone,
    whatsappNumber: publicSettings?.whatsappNumber,
  });

  return (
    <HomePage
      localBusiness={localBusiness}
      heroInitialSettings={heroInitialSettings}
    />
  );
}
