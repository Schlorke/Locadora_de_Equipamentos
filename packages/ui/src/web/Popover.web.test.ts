import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Popover", () => {
  it("mantém alinhamento central, deslocamento 4 e a camada 95", () => {
    const source = readFileSync(new URL("./Popover.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('align = "center"');
    expect(source).toContain("sideOffset = 4");
    expect(source).toContain("z-[95]");
    expect(source).toContain("w-96");
    expect(source).toContain("max-w-[calc(100vw-2rem)]");
    expect(source).toContain("rounded-lg");
    expect(source).toContain("bg-white");
    expect(source).toContain("p-4");
  });
});
