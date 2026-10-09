import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Progress", () => {
  it("mantém track secondary, indicador primary e translateX no web", () => {
    const source = readFileSync(new URL("./Progress.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("relative h-4 w-full overflow-hidden rounded-full bg-secondary");
    expect(source).toContain("h-full w-full flex-1 bg-primary transition-all");
    expect(source).toContain("translateX(-${100 - (value || 0)}%)");
    const native = readFileSync(new URL("../native/Progress.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-secondary");
    expect(native).not.toContain("bg-primary");
    expect(native).not.toContain("translateX");
    expect(native).not.toContain("className");
  });
});
