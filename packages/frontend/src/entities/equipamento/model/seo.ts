export type EquipmentSeoSource = {
  name: string;
  description?: string | null;
  images?: string[] | null;
  category?: { name?: string | null } | null;
};

/**
 * Locadora dona do equipamento: nome e cidade do cartão público dela e a origem canônica do site dela
 * (`https://{slug}.<raiz>`). Campo ausente fica de fora do SEO; nunca entra dado de outra locadora (T12; achado 143).
 */
export type EquipmentSeoStore = {
  name?: string | null;
  origin?: string | null;
  city?: string | null;
  /** UF do cartão da locadora: região de entrega do JSON-LD (achado 143; antes, "RS" fixo da GB). */
  state?: string | null;
};

const text = (value: string | null | undefined): string | undefined => value?.trim() || undefined;
const originOf = (store?: EquipmentSeoStore | null): string => text(store?.origin)?.replace(/\/+$/, "") ?? "";

export function buildEquipmentSeoDescription(equipment: EquipmentSeoSource, city?: string | null): string {
  const where = text(city) ? ` em ${text(city)}` : "";
  const seoDescription = equipment.description
    ? `${equipment.description.slice(0, 140)}... Solicite seu orçamento${where}!`
    : `Aluguel de ${equipment.name} para construção civil.${where ? ` Locação profissional${where}.` : ""} Solicite seu orçamento!`;

  return seoDescription.length <= 160 ? seoDescription : `${seoDescription.slice(0, 157)}...`;
}

/** Canonical do equipamento: absoluto na origem da locadora; sem ela, caminho relativo (ADR, Lote 5). */
export function buildEquipmentCanonicalUrl(id: string, origin?: string | null): string {
  return `${originOf({ origin })}/equipamentos/${id}`;
}

export function buildEquipmentImageUrl(images?: string[] | null, origin?: string | null): string {
  const primaryImage = images?.[0] || "/placeholder.jpg";
  return primaryImage.startsWith("http") ? primaryImage : `${originOf({ origin })}${primaryImage}`;
}

export function buildEquipmentSeo(equipment: EquipmentSeoSource, id: string, store?: EquipmentSeoStore | null) {
  const name = text(store?.name);
  const city = text(store?.city);
  const seoDescription = buildEquipmentSeoDescription(equipment, city);
  const canonicalUrl = buildEquipmentCanonicalUrl(id, store?.origin);
  const imageUrl = buildEquipmentImageUrl(equipment.images, store?.origin);
  const byStore = name ? ` | ${name}` : "";

  return {
    title: `Aluguel de ${equipment.name}${city ? ` em ${city}` : ""}${byStore}`,
    description: seoDescription,
    keywords: [
      `aluguel ${equipment.name.toLowerCase()}`,
      `locação ${equipment.name.toLowerCase()}`,
      city ? `equipamentos construção civil ${city.toLowerCase()}` : "equipamentos construção civil",
      ...(name ? [name.toLowerCase()] : []),
      equipment.category?.name?.toLowerCase() || "",
      "locação equipamentos obras",
    ],
    canonicalUrl,
    openGraphTitle: `Aluguel de ${equipment.name}${byStore}`,
    openGraphDescription: seoDescription,
    imageUrl,
    imageAlt: `${equipment.name} para locação${name ? ` - ${name}` : ""}`,
  };
}

export function buildEquipmentProductStructuredData(
  equipment: EquipmentSeoSource & { id: string; available: boolean; pricePerDay: number },
  id: string,
  store?: EquipmentSeoStore | null,
) {
  const name = text(store?.name);
  const origin = originOf(store);
  const state = text(store?.state)?.toUpperCase();
  return {
    name: equipment.name,
    description: equipment.description || `Aluguel de ${equipment.name} para construção civil`,
    image: equipment.images || ["/placeholder.jpg"],
    ...(name ? { brand: name, manufacturer: name, seller: { name, ...(origin ? { url: origin } : {}) } } : {}),
    sku: equipment.id,
    offers: {
      price: equipment.pricePerDay,
      priceCurrency: "BRL",
      availability: equipment.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: buildEquipmentCanonicalUrl(id, store?.origin),
    },
    category: equipment.category?.name || "Equipamentos para Construção",
    ...(state && /^[A-Z]{2}$/.test(state) ? { shippingRegion: state } : {}),
  };
}

export function buildEquipmentBreadcrumbs(
  equipment: EquipmentSeoSource,
  id: string,
  categorySlug?: string | null,
  origin?: string | null,
) {
  const base = originOf({ origin });
  return [
    { name: "Home", url: base || "/" },
    { name: "Equipamentos", url: `${base}/equipamentos` },
    {
      name: equipment.category?.name || "Categoria",
      url: `${base}/equipamentos?categoria=${categorySlug || ""}`,
    },
    {
      name: equipment.name,
      url: buildEquipmentCanonicalUrl(id, origin),
    },
  ];
}
