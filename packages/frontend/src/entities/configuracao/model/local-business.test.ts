// LocalBusiness só com os dados da própria locadora (achado 143; T12 da ADR adr-tenant-hosts). O teste anterior
// afirmava o defeito: sem configuração, a função devolvia o nome, o CNPJ, o endereço e os telefones da GB.
import { describe, expect, it } from "vitest";
import { getLocalBusinessData, openingHoursSchemaOrg } from "./local-business";

const IDENTIDADE = { name: "Locadora Alfa", url: "https://locadora-alfa.example.test/", city: "Curitiba", state: "PR" };

describe("getLocalBusinessData", () => {
  it("sem identidade da locadora não há LocalBusiness, nem com configurações", () => {
    expect(getLocalBusinessData()).toBeNull();
    expect(getLocalBusinessData({ companyPhone: "(41) 3000-0000" })).toBeNull();
    expect(getLocalBusinessData({}, { name: "  " })).toBeNull();
  });

  it("locadora sem configurações: só o nome e a origem dela, nenhum dado de outra locadora", () => {
    const data = getLocalBusinessData(undefined, IDENTIDADE);
    expect(data).toEqual({ name: "Locadora Alfa", url: "https://locadora-alfa.example.test" });
    expect(JSON.stringify(data)).not.toMatch(/GB Loca|locacoesgb|34\.780\.330|Heinzelmann|2313|99820|Porto Alegre/i);
  });

  it("monta o negócio com o contato, o endereço, as redes e o logo da própria locadora", () => {
    const data = getLocalBusinessData(
      {
        companyPhone: "(41) 3000-0000",
        whatsappNumber: "(41) 99999-0000",
        contactEmail: "contato@alfa.example.test",
        companyAddress: "Rua A, 10 - Centro",
        aboutUsText: "Locação em Curitiba",
        socialLinks: { facebook: "https://facebook.example.test/alfa", instagram: "", linkedin: "javascript:alert(1)" },
      },
      { ...IDENTIDADE, logoUrl: "https://cdn.example.test/logo.png" }
    );
    expect(data).toEqual({
      name: "Locadora Alfa",
      description: "Locação em Curitiba",
      url: "https://locadora-alfa.example.test",
      telephone: "+55 4130000000",
      email: "contato@alfa.example.test",
      address: { streetAddress: "Rua A, 10 - Centro", addressLocality: "Curitiba", addressRegion: "PR", addressCountry: "BR" },
      contactPoints: [
        { contactType: "Serviço ao cliente", telephone: "+55 4130000000", availableLanguage: "Português" },
        { contactType: "Atendimento via WhatsApp", telephone: "+55 41999990000", availableLanguage: "Português" },
      ],
      sameAs: ["https://facebook.example.test/alfa", "https://api.whatsapp.com/send?phone=5541999990000"],
      image: "https://cdn.example.test/logo.png",
    });
  });

  it("só WhatsApp: vira o telefone do negócio", () => {
    expect(getLocalBusinessData({ whatsappNumber: "(41) 99999-0000" }, IDENTIDADE)?.telephone).toBe("+55 41999990000");
  });
});

// Onda 134: geo e hasMap do local declarado e openingHours do horário da própria locadora; nunca aggregateRating.
describe("getLocalBusinessData com local e horário da locadora", () => {
  const HORARIO = {
    monday: { closed: false, open: "08:00", close: "18:00" },
    tuesday: { closed: false, open: "08:00", close: "18:00" },
    wednesday: { closed: false, open: "08:00", close: "18:00" },
    thursday: { closed: false, open: "08:00", close: "18:00" },
    friday: { closed: false, open: "08:00", close: "18:00" },
    saturday: { closed: false, open: "08:00", close: "12:00" },
    sunday: { closed: true },
  };
  const LOCAL = { latitude: -25.4284, longitude: -49.2733, addressLine1: "Rua A, 10" };

  it("geo, hasMap e openingHours no formato da produção", () => {
    const data = getLocalBusinessData({ businessHours: HORARIO, siteContent: { storeLocation: LOCAL } }, IDENTIDADE);
    expect(data?.geo).toEqual({ latitude: -25.4284, longitude: -49.2733 });
    expect(data?.hasMap).toBe("https://www.google.com/maps?q=-25.4284,-49.2733&hl=pt-BR");
    expect(data?.openingHours).toEqual(["Mo-Fr 08:00-18:00", "Sa 08:00-12:00"]);
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
  });

  it("dia fechado ou sem dado quebra a faixa; horário inválido ou ausente não gera nada", () => {
    expect(
      openingHoursSchemaOrg({
        monday: { closed: false, open: "08:00", close: "18:00" },
        tuesday: { closed: false, open: "08:00", close: "18:00" },
        thursday: { closed: false, open: "08:00", close: "18:00" },
        sunday: { closed: false, open: "09:00", close: "12:00" },
      })
    ).toEqual(["Mo-Tu 08:00-18:00", "Th 08:00-18:00", "Su 09:00-12:00"]);
    expect(openingHoursSchemaOrg({ monday: { open: "8h", close: "18h" } })).toEqual([]);
    expect(openingHoursSchemaOrg(null)).toEqual([]);
    const semNada = getLocalBusinessData({ siteContent: { storeLocation: { latitude: 99 } } }, IDENTIDADE);
    expect(semNada).not.toHaveProperty("geo");
    expect(semNada).not.toHaveProperty("hasMap");
    expect(semNada).not.toHaveProperty("openingHours");
  });
});

describe("getLocalBusinessData com o catálogo da locadora (onda 134)", () => {
  const IDENTIDADE_B = { name: "Locadora Alfa", url: "https://alfa.example.test" };
  it("as categorias reais da locadora viram o catálogo de ofertas (sem repetição nem nome vazio)", () => {
    expect(getLocalBusinessData({}, IDENTIDADE_B, ["Andaimes", " Betoneiras ", "", "Andaimes"])?.offerCatalog).toEqual([
      "Andaimes",
      "Betoneiras",
    ]);
  });
  it("sem categorias, nenhum catálogo (nunca uma lista fixa)", () => {
    expect(getLocalBusinessData({}, IDENTIDADE_B)).not.toHaveProperty("offerCatalog");
    expect(getLocalBusinessData({}, IDENTIDADE_B, [])).not.toHaveProperty("offerCatalog");
  });
});

// Decisão D-A do dono (2026-10-07): a nota com fonte declarada no painel aparece só na página do equipamento; nunca vira
// aggregateRating (nem review) no LocalBusiness. Segunda rodada da onda 134: nenhum teste passava `reviews` ao JSON-LD.
describe("getLocalBusinessData com a nota de avaliações declarada (D-A)", () => {
  const NOTA = { rating: 4.8, count: 127, sourceName: "Google", sourceUrl: "https://maps.example.test/locadora-alfa" };
  it("a nota com fonte não muda nada no LocalBusiness: nenhum aggregateRating, review ou campo da fonte", () => {
    const local = { latitude: -25.4284, longitude: -49.2733, addressLine1: "Rua A, 10" };
    const semNota = getLocalBusinessData({ companyPhone: "(41) 3000-0000", siteContent: { storeLocation: local } }, IDENTIDADE, ["Andaimes"]);
    const comNota = getLocalBusinessData(
      { companyPhone: "(41) 3000-0000", siteContent: { storeLocation: local, reviews: NOTA } },
      IDENTIDADE,
      ["Andaimes"]
    );
    expect(comNota).toEqual(semNota);
    expect(JSON.stringify(comNota)).not.toMatch(/aggregateRating|ratingValue|reviewCount|"review|4\.8|127|maps\.example/i);
  });
});
