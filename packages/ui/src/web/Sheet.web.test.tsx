import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sheet", () => {
  it("abre pela direita, com overlay preto e fechar em inglês", () => {
    const source = readFileSync(new URL("./Sheet.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("side: 'right'");
    expect(source).toContain("side = 'right'");
    expect(source).toContain("bg-black/80");
    expect(source).toContain("w-3/4");
    expect(source).toContain("sm:max-w-sm");
    expect(source).toContain('aria-label="Close"');
    expect(source).toContain("hover:text-orange-600");
    const native = readFileSync(new URL("../native/Sheet.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-black/80");
  });
});
