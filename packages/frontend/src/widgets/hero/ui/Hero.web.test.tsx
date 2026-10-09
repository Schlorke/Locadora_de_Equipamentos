import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import Hero, { HERO_SUBTITULO_PADRAO, subtituloDoHero } from "./Hero.web";

/** Fatos da GB que o hero mostrava em qualquer locadora (achado 143): anos de mercado e tamanho da frota. */
const FATOS_DA_GB = /10\+|Há 10 anos|Anos de Experiência|\+200|Equipamentos Disponíveis|GB Loca/i;

describe("Hero", () => {
  it("mantém o título, a busca e o carregamento 3D sem SSR", () => {
    const source = readFileSync(new URL("./Hero.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Construção Civil");
    expect(source).toContain('placeholder="Buscar equipamentos (ex: andaime, betoneira)"');
    expect(source).toContain("Entregamos em toda região");
    expect(source).toContain('href="/equipamentos"');
    expect(source).toContain("Carregando modelos 3D...");
    expect(source).toContain("ssr: false");
    expect(source).toContain("./Equipment3DCarousel.web");
    expect(source).toContain("name: 'Compressor de Ar'");
    expect(source).toContain("modelUrl: '/models/Compressor.glb'");
    expect(source).toContain("name: 'Betoneira'");
    expect(source).toContain("name: 'Andaime'");
    // Sincronização do primeiro modelo com o ScrollReveal (docs/features/equipment-3d-carousel.md).
    expect(source).toContain("isRevealComplete={isScrollRevealReady}");
  });

  it("sem fato de uma empresa: subtítulo do modelo e nenhum selo de anos ou de frota (o teste anterior exigia \"Há 10 anos\")", () => {
    const html = renderToStaticMarkup(
      <Hero initialSettings={{ heroCarousel: [], waveAnimation: "none" }} />,
    );
    expect(html).toContain(HERO_SUBTITULO_PADRAO);
    expect(html).toContain("hero-border");
    expect(html).not.toContain("hero-badge-left");
    expect(html).not.toContain("hero-badge-right");
    expect(html.match(FATOS_DA_GB)?.[0]).toBeUndefined();
  });

  it("selos e subtítulo só com o conteúdo da própria locadora (onda 134), na marcação de 55763c1e", () => {
    const html = renderToStaticMarkup(
      <Hero initialSettings={{ heroCarousel: [], waveAnimation: "none", siteContent: { experienceYears: 10, fleetSize: 200 } }} />,
    );
    expect(html).toContain(subtituloDoHero(10));
    expect(subtituloDoHero(10)).toBe(
      "Há 10 anos oferecendo soluções em locação de equipamentos para obras e serviços em altura. Segurança, qualidade e manutenção constante.",
    );
    expect(html).toMatch(
      /<div class="hero-badge-left hidden sm:block absolute -bottom-2 -left-2 bg-yellow-500 text-gray-900 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20" style="opacity:0"><div class="text-2xl font-bold animate-count-up">\+200<\/div><div class="text-sm font-medium">Equipamentos Disponíveis<\/div><\/div>/,
    );
    expect(html).toMatch(
      /<div class="hero-badge-right hidden sm:block absolute -top-2 -right-2 bg-white\/90 backdrop-blur-sm text-orange-600 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20" style="opacity:0"><div class="text-2xl font-bold">10\+<\/div><div class="text-sm font-medium">Anos de Experiência<\/div><\/div>/,
    );
    // Ordem de 55763c1e: selo da esquerda, selo da direita e a borda.
    expect(html.indexOf("hero-badge-left")).toBeLessThan(html.indexOf("hero-badge-right"));
    expect(html.indexOf("hero-badge-right")).toBeLessThan(html.indexOf("hero-border"));
  });

  it("cada selo depende só do próprio número; um ano no singular", () => {
    const soAnos = renderToStaticMarkup(<Hero initialSettings={{ heroCarousel: [], waveAnimation: "none", siteContent: { experienceYears: 1 } }} />);
    expect(soAnos).toContain("hero-badge-right");
    expect(soAnos).not.toContain("hero-badge-left");
    expect(soAnos).toContain("Há 1 ano oferecendo soluções");
    const soFrota = renderToStaticMarkup(<Hero initialSettings={{ heroCarousel: [], waveAnimation: "none", siteContent: { fleetSize: 1200 } }} />);
    expect(soFrota).toContain(">+1.200<");
    expect(soFrota).not.toContain("hero-badge-right");
    expect(soFrota).toContain(HERO_SUBTITULO_PADRAO);
  });

  it("o hero nunca usa o texto \"Sobre nós\" (achado 1.9.1 do plano da onda 134)", () => {
    const html = renderToStaticMarkup(
      <Hero initialSettings={{ heroCarousel: [], waveAnimation: "none", aboutUsText: "Texto Sobre nós da Locadora Nova" }} />,
    );
    expect(html).not.toContain("Texto Sobre nós");
    expect(html).toContain(HERO_SUBTITULO_PADRAO);
  });
});
