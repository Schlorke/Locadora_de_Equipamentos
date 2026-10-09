import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Texto giratório", () => {
  it("gira a cada 2000 ms, por caracteres, começando no primeiro", () => {
    const source = readFileSync(new URL("./RotatingText.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("rotationInterval = 2000");
    expect(source).toContain("staggerStrategy = 'first'");
    expect(source).toContain("splitBy = 'characters'");
    expect(source).toContain("window.setInterval(next, rotationInterval)");
  });
});
