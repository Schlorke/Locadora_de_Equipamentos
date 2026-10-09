import { describe, expect, it } from "vitest";
import { buildHeroInitialSettings, normalizeWaveAnimation, parseHeroCarousel } from "./hero-settings";

describe("hero da home", () => {
  it("descarta carrossel inválido e aparas o endereço da imagem", () => {
    expect(parseHeroCarousel(null)).toEqual([]);
    expect(parseHeroCarousel([{ imageUrl: "  /foto.jpg  " }, { imageUrl: "  " }, { nome: "x" }])).toEqual([{ imageUrl: "/foto.jpg" }]);
  });

  it("só aceita none, static e animated", () => {
    expect(normalizeWaveAnimation("static")).toBe("static");
    expect(normalizeWaveAnimation("outra")).toBe("animated");
    expect(normalizeWaveAnimation(undefined)).toBe("animated");
  });

  it("monta o recorte inicial do hero", () => {
    expect(buildHeroInitialSettings({ heroCarousel: [{ imageUrl: "/a.jpg" }], waveAnimation: "none" })).toEqual({
      heroCarousel: [{ imageUrl: "/a.jpg" }],
      waveAnimation: "none",
      siteContent: {},
      companyPhone: "",
      whatsappNumber: "",
    });
  });

  it("leva ao SSR o telefone e o WhatsApp da leitura pública, aparados; ausente ou fora do formato, vazio", () => {
    expect(buildHeroInitialSettings({ companyPhone: " (51) 3000-0000 ", whatsappNumber: "(51) 99999-0000" })).toMatchObject({
      companyPhone: "(51) 3000-0000",
      whatsappNumber: "(51) 99999-0000",
    });
    expect(buildHeroInitialSettings({ companyPhone: "(41) 3333-4444", whatsappNumber: null })).toMatchObject({
      companyPhone: "(41) 3333-4444",
      whatsappNumber: "",
    });
    expect(buildHeroInitialSettings({ companyPhone: 51, whatsappNumber: "   " })).toMatchObject({ companyPhone: "", whatsappNumber: "" });
  });

  it("leva ao SSR só os anos de mercado e a frota da própria locadora; nunca o texto \"Sobre nós\" (onda 134)", () => {
    const hero = buildHeroInitialSettings({
      heroCarousel: [],
      waveAnimation: "animated",
      aboutUsText: "Texto Sobre nós da locadora",
      siteContent: { experienceYears: 12, fleetSize: 80, clientsServed: 300, history: "História", commitments: { support24h: true } },
    } as Parameters<typeof buildHeroInitialSettings>[0]);
    expect(hero).toEqual({
      heroCarousel: [],
      waveAnimation: "animated",
      siteContent: { experienceYears: 12, fleetSize: 80 },
      companyPhone: "",
      whatsappNumber: "",
    });
    expect(JSON.stringify(hero)).not.toContain("Sobre nós");
  });

  it("número fora do contrato fica de fora, chave a chave (leitura tolerante)", () => {
    expect(buildHeroInitialSettings({ siteContent: { experienceYears: "10", fleetSize: 200 } }).siteContent).toEqual({ fleetSize: 200 });
    expect(buildHeroInitialSettings({ siteContent: { experienceYears: 0 } }).siteContent).toEqual({});
    expect(buildHeroInitialSettings({ siteContent: "x" }).siteContent).toEqual({});
  });
});
