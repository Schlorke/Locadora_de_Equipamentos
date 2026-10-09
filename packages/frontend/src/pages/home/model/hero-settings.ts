import { parsePublicSiteContent, type SiteContent } from "@gb-locacoes/contracts/settings";

export type WaveAnimationSetting = "none" | "static" | "animated";

/** Números do conteúdo institucional que o hero mostra (selos e subtítulo), já no SSR para não haver salto. */
export type HeroSiteContent = Pick<SiteContent, "experienceYears" | "fleetSize">;

export type HeroInitialSettings = {
  heroCarousel: Array<{ imageUrl: string }>;
  waveAnimation: WaveAnimationSetting;
  siteContent: HeroSiteContent;
  /** Telefone e WhatsApp públicos da própria locadora, aparados; '' sem o número (o hero mostra só os presentes). */
  companyPhone: string;
  whatsappNumber: string;
};

export function parseHeroCarousel(value: unknown): Array<{ imageUrl: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const imageUrl = (item as { imageUrl?: unknown }).imageUrl;
      if (typeof imageUrl !== "string") return null;
      const trimmed = imageUrl.trim();
      if (!trimmed) return null;
      return { imageUrl: trimmed };
    })
    .filter((item): item is { imageUrl: string } => item !== null);
}

export function normalizeWaveAnimation(value: unknown): WaveAnimationSetting {
  if (value === "none" || value === "static" || value === "animated") return value;
  return "animated";
}

/** Número público (telefone ou WhatsApp) aparado; fora do formato ou ausente, ''. */
function numeroPublico(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Recorte inicial do hero (SSR). Onda 134: leva os anos de mercado e a frota da própria locadora (lidos chave a chave,
 * como a leitura pública) e nunca o texto "Sobre nós": o subtítulo do hero vem só dos anos (achado 1.9.1 do plano).
 * Leva também o telefone e o WhatsApp da leitura pública: com o recorte inicial o hero não consulta a API, e sem eles
 * o hero de toda locadora ficava com o "|" sozinho no lugar dos números que a produção mostrava.
 */
export function buildHeroInitialSettings(data: {
  heroCarousel?: unknown;
  waveAnimation?: unknown;
  siteContent?: unknown;
  companyPhone?: unknown;
  whatsappNumber?: unknown;
}): HeroInitialSettings {
  const { content } = parsePublicSiteContent(data.siteContent);
  return {
    heroCarousel: parseHeroCarousel(data.heroCarousel),
    waveAnimation: normalizeWaveAnimation(data.waveAnimation),
    siteContent: {
      ...(content.experienceYears !== undefined ? { experienceYears: content.experienceYears } : {}),
      ...(content.fleetSize !== undefined ? { fleetSize: content.fleetSize } : {}),
    },
    companyPhone: numeroPublico(data.companyPhone),
    whatsappNumber: numeroPublico(data.whatsappNumber),
  };
}
