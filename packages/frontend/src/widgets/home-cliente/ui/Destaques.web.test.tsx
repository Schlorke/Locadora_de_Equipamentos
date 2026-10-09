import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Destaques", () => {
  it("busca 6 equipamentos e avisa o scroll reveal", () => {
    const source = readFileSync(new URL("./Destaques.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("fetch('/api/equipments')");
    expect(source).toContain("slice(0, 6)");
    expect(source).toContain("Array.from({ length: 6 })");
    expect(source).toContain("featuredMaterialsLoaded");
    expect(source).toContain("Equipamentos em Destaque");
    expect(source).toContain("Nossos equipamentos mais procurados");
    expect(source).toContain('id="equipamentos-destaque"');
    // Revelação: escondido no primeiro quadro só sem movimento reduzido (com ele, nasce visível sem depender do JS).
    expect(source).toContain("motion-safe:opacity-0");
    expect(source).not.toMatch(/translateY\(60px\)|[\s"']opacity-0[\s"']/);
    expect(source).toContain("Erro ao carregar equipamentos em destaque:");
  });
});
