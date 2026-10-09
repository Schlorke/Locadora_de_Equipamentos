import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Scroll infinito", () => {
  it("lista 18 equipamentos a 0,5 px por frame e para com reduced motion", () => {
    const source = readFileSync(new URL("./ScrollInfinito.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("fetch('/api/equipments')");
    expect(source).toContain("slice(0, 18)");
    expect(source).toContain("Nossos Equipamentos");
    expect(source).toContain("Confira nossa linha completa de equipamentos para locação");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("baseSpeed: reduceMotion ? 0 : 0.5");
    expect(source).toContain("RETURN_FORCE = 0.02");
    expect(source).toContain("Erro ao carregar equipamentos:");
  });
});
