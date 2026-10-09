import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Filtros", () => {
  it("abre o seletor em z-25 e alinha o grupo a partir de 180px", () => {
    const select = readFileSync(new URL("./CustomSelect.web.tsx", import.meta.url), "utf8");
    const group = readFileSync(new URL("./FilterSelectGroup.web.tsx", import.meta.url), "utf8");
    expect(select).toContain("placeholder = 'Selecionar...'");
    expect(select).toContain("z-[var(--layer-dropdown)]");
    expect(select).toContain("z-[25]");
    expect(select).toContain("h-10 w-full");
    expect(group).toContain("filter.placeholder || filter.label");
    expect(group).toContain("lg:min-w-[180px] h-10");
    expect(group).toContain("lg:hidden");
    expect(group).toContain("hidden lg:flex");
    const native = readFileSync(new URL("../native/FilterSelect.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("z-[25]");
  });
});
