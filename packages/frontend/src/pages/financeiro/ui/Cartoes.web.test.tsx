import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cartões do painel financeiro", () => {
  it("mantém a grade, o atraso e o anel laranja da seleção", () => {
    const source = readFileSync(new URL("./Cartoes.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4");
    expect(source).toContain("delay: 0.2 + index * 0.06");
    expect(source).toContain("hover:scale-[1.02]");
    expect(source).toContain("border-orange-300 ring-1 ring-orange-200");
    expect(source).toContain("border-gray-100");
    expect(source).toContain("hasSelection");
  });
});
