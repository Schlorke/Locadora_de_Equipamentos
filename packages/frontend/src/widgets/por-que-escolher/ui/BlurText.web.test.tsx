import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Texto borrado", () => {
  it("espera 200 ms, anima por palavras e entra de cima", () => {
    const source = readFileSync(new URL("./BlurText.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("delay = 200");
    expect(source).toContain("animateBy = 'words'");
    expect(source).toContain("direction = 'top'");
    expect(source).toContain("text.split(' ')");
    expect(source).toContain("blur-text flex flex-wrap gap-x-2");
  });
});
