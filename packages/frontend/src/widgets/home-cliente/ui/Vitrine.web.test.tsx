import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vitrine da home", () => {
  it("mostra 12 categorias por aba e gira o texto a cada 3200 ms", () => {
    const source = readFileSync(new URL("./Vitrine.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("fetch('/api/categories')");
    expect(source).toContain("const MAX_CATEGORIES_PER_TAB = 12");
    expect(source).toContain("label: 'Categorias'");
    expect(source).toContain("label: 'Fases da obra'");
    expect(source).toContain("label: 'Tipo de trabalho'");
    expect(source).toContain("value: 'mais-alugados'");
    expect(source).toContain("value: 'fases-obra'");
    expect(source).toContain("value: 'tipo-trabalho'");
    expect(source).toContain("Tecnologia");
    expect(source).toContain("para cada fase da sua obra");
    expect(source).toContain("['sob medida', 'certa', 'eficiente']");
    expect(source).toContain("rotationInterval={3200}");
    expect(source).toContain("bg-[#334155]");
    expect(source).toContain("window.location.href = `/equipamentos?categoria=${category.id}`");
  });
});
