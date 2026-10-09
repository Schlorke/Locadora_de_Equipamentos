import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ViewToggle", () => {
  it("mede h-10 no tamanho médio e desliza com mola 300", () => {
    const source = readFileSync(new URL("./ViewToggle.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("size = 'md'");
    expect(source).toContain("size === 'sm' ? 'h-9' : size === 'lg' ? 'h-11' : 'h-10'");
    expect(source).toContain("bg-slate-700");
    expect(source).toContain("stiffness: 300");
    expect(source).toContain("damping: 30");
    expect(source).toContain("'text-white hover:text-white'");
    expect(source).toContain("'text-inherit hover:text-orange-600'");
    expect(source).toContain("hidden sm:inline");
    expect(source).toContain("setTimeout");
    const native = readFileSync(new URL("../native/ViewToggle.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-slate-700");
  });
});
