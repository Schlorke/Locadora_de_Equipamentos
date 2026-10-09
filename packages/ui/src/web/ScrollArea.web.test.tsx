import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ScrollArea", () => {
  it("rola 40 pixels e mantém os rótulos em português", () => {
    const source = readFileSync(new URL("./ScrollArea.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("const SCROLL_STEP = 40");
    expect(source).toContain("const thumbThickness = '6px'");
    expect(source).toContain('aria-label="Rolar para cima"');
    expect(source).toContain('aria-label="Rolar para baixo"');
    expect(source).toContain('aria-label="Rolar para esquerda"');
    expect(source).toContain('aria-label="Rolar para direita"');
    expect(source).toContain("bg-orange-600 hover:bg-orange-700");
    expect(source).toContain("forceMount");
    const native = readFileSync(new URL("../native/ScrollArea.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-orange-600");
  });
});
