// Rodapé da vitrine só com os dados da própria locadora (achado 143; T12 da ADR adr-tenant-hosts). O teste anterior
// conferia o código-fonte e afirmava o defeito: CNPJ, horário, copyright e alt fixos da GB para qualquer locadora.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  identidade: null as null | { nome: string; cidade: string | null; uf: string | null; logoUrl: string | null },
}));
vi.mock("../../../entities/configuracao", async (original) => ({
  ...(await original<typeof import("../../../entities/configuracao")>()),
  usePublicSettings: () => ({ settings: estado.settings }),
}));
vi.mock("../../../entities/organizacao", async (original) => ({
  ...(await original<typeof import("../../../entities/organizacao")>()),
  useIdentidadePublica: () => estado.identidade,
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <img alt={props.alt} /> }));

import Footer from "./Footer.web";

const VAZIAS = {
  companyPhone: "",
  whatsappNumber: "",
  contactEmail: "",
  marketingEmail: "",
  companyAddress: "",
  companyIconUrl: "",
  aboutUsText: "",
  socialLinks: {},
};
const DADOS_DA_GB = /GB Loca|locacoesgb|locacoes_gb|34\.780\.330|Heinzelmann|Humait|2313-6262|99820-5163|Porto Alegre|Seg-Sex|8h às 18h/i;
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);

beforeEach(() => {
  estado.settings = { ...VAZIAS };
  estado.identidade = null;
});

describe("Footer", () => {
  it("locadora sem configurações: nome e sigla do cartão dela e nenhum dado de outra locadora", () => {
    estado.identidade = { nome: "Locadora Nova", cidade: "Curitiba", uf: "PR", logoUrl: null };
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(">LN<");
    expect(html).toContain(">Locadora Nova<");
    // O ano é o texto do modelo de site (o mesmo de antes); o nome é o da própria locadora.
    expect(html).toContain("© 2024 Locadora Nova. Todos os direitos reservados.");
    expect(html).not.toMatch(DADOS_DA_GB);
    expect(html).not.toContain("CNPJ");
    expect(html).not.toContain(">Contato</h3>");
    expect(hrefs(html).filter((href) => /^(tel|mailto|https?):/.test(href!))).toEqual([]);
  });

  it("sem locadora (modo legado sem seleção): nem nome, nem sigla, nem marca padrão", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(">Todos os direitos reservados.<");
    expect(html).not.toMatch(DADOS_DA_GB);
    expect(html).not.toMatch(/>GB</);
  });

  it("locadora configurada: texto, redes, contato e endereço dela", () => {
    estado.identidade = { nome: "Andaimes Sul", cidade: null, uf: null, logoUrl: null };
    estado.settings = {
      ...VAZIAS,
      companyPhone: "(41) 3000-0000",
      whatsappNumber: "(41) 99999-0000",
      contactEmail: "contato@andaimes-sul.example.test",
      companyAddress: "Rua B, 20 - Centro, Curitiba - PR",
      aboutUsText: "Andaimes em Curitiba.",
      socialLinks: { facebook: "https://facebook.example.test/andaimes-sul" },
      legalDocuments: { terms: true, privacy: true, returnPolicy: true },
    };
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(">AS<");
    expect(html).toContain("Andaimes em Curitiba.");
    expect(html).toContain("Rua B, 20<br/>");
    expect(hrefs(html)).toEqual(
      expect.arrayContaining([
        "https://facebook.example.test/andaimes-sul",
        "tel:+554130000000",
        "tel:+5541999990000",
        "mailto:contato@andaimes-sul.example.test",
        "/orcamento",
        "/privacidade",
        "/termos",
        "/cookies",
        "/politica-devolucao",
      ])
    );
    expect(html).not.toMatch(DADOS_DA_GB);
  });

  // Achado 147: o horário e o CNPJ voltam ao rodapé, lidos das configurações públicas e da organização da PRÓPRIA
  // locadora, nas linhas da produção ("Seg-Sex: 8h às 18h", "Sáb: 8h às 12h", "CNPJ: …").
  it("horário e CNPJ da própria locadora, nas linhas da produção", () => {
    estado.identidade = { nome: "Locadora Nova", cidade: "Curitiba", uf: "PR", logoUrl: null };
    const aberto = (open: string, close: string) => ({ closed: false, open, close });
    estado.settings = {
      ...VAZIAS,
      businessHours: {
        monday: aberto("08:00", "18:00"),
        tuesday: aberto("08:00", "18:00"),
        wednesday: aberto("08:00", "18:00"),
        thursday: aberto("08:00", "18:00"),
        friday: aberto("08:00", "18:00"),
        saturday: aberto("08:00", "12:00"),
        sunday: { closed: true },
      },
      legalIdentity: { legalName: "Locadora Nova", cnpj: "11.222.333/0001-81" },
    };
    const html = renderToStaticMarkup(<Footer />);
    // A coluna de contato aparece só com o horário e o CNPJ (sem telefone, e-mail ou endereço).
    expect(html).toContain(">Contato</h3>");
    expect(html).toContain(">Seg-Sex: 8h às 18h</p>");
    expect(html).toContain(">Sáb: 8h às 12h</p>");
    expect(html).toContain('<p class="text-sm text-gray-400">CNPJ: 11.222.333/0001-81</p>');
    expect(html).not.toContain("Dom");
    expect(html).not.toMatch(/34\.780\.330|GB Loca/);
  });

  it("só o CNPJ (sem horário) continua no rodapé; nome empresarial diferente entra na linha", () => {
    estado.identidade = { nome: "Locadora Nova", cidade: null, uf: null, logoUrl: null };
    estado.settings = {
      ...VAZIAS,
      legalIdentity: { legalName: "Nova Equipamentos Ltda", cnpj: "11.222.333/0001-81" },
    };
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(">Nova Equipamentos Ltda · CNPJ: 11.222.333/0001-81</p>");
    expect(html).not.toMatch(/Seg-Sex|8h às/);
  });

  // Onda 134: a coluna "Equipamentos" vem dos destaques da própria locadora, os links legais só dos documentos que ela
  // publicou (Cookies é da plataforma e fica sempre) e a resposta rápida só com o compromisso declarado.
  it("Locadora Nova sem conteúdo: sem a coluna de destaques, sem links de documentos não publicados e sem promessa", () => {
    estado.identidade = { nome: "Locadora Nova", cidade: "Curitiba", uf: "PR", logoUrl: null };
    estado.settings = { ...VAZIAS, contactEmail: "contato@locadora-nova.example.test" };
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toContain(">Equipamentos</h3>");
    expect(html).not.toMatch(/Andaimes Suspensos|Cadeiras Elétricas|Betoneiras|Compressores/);
    const links = hrefs(html);
    expect(links).toContain("/cookies");
    for (const pagina of ["/privacidade", "/termos", "/politica-devolucao"]) expect(links).not.toContain(pagina);
    expect(html).not.toContain("Resposta rápida garantida");
  });

  it("com destaques, documentos e compromisso: a coluna, os links publicados e a linha da produção", () => {
    estado.identidade = { nome: "Locadora Nova", cidade: "Curitiba", uf: "PR", logoUrl: null };
    estado.settings = {
      ...VAZIAS,
      contactEmail: "contato@locadora-nova.example.test",
      siteContent: {
        footerHighlights: ["Andaimes", "Betoneiras"],
        commitments: { fastResponseGuaranteed: true },
      },
      legalDocuments: { terms: true, privacy: false, returnPolicy: true },
    };
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(">Equipamentos</h3>");
    const coluna = html.slice(html.indexOf(">Equipamentos</h3>"), html.indexOf(">Contato</h3>"));
    expect([...coluna.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]])).toEqual([
      ["/equipamentos", "Andaimes"],
      ["/equipamentos", "Betoneiras"],
    ]);
    const legais = html.slice(html.indexOf("Todos os direitos reservados"));
    expect([...legais.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/termos", "/cookies", "/politica-devolucao"]);
    expect(html).toContain('<p class="text-sm text-gray-400">Resposta rápida garantida</p>');
  });

  it("logo da locadora com o nome dela no alt", () => {
    estado.identidade = { nome: "Andaimes Sul", cidade: null, uf: null, logoUrl: null };
    estado.settings = { ...VAZIAS, companyIconUrl: "https://cdn.example.test/logo.png" };
    expect(renderToStaticMarkup(<Footer />)).toContain('alt="Andaimes Sul"');
  });
});
