import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tooltip e Avatar", () => {
  it("mantém o deslocamento 4 e o fundo slate-900 da dica", () => {
    const source = readFileSync(new URL("./Tooltip.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("sideOffset = 4");
    expect(source).toContain("z-50");
    expect(source).toContain("bg-slate-900");
    expect(source).toContain("text-slate-50");
    const native = readFileSync(new URL("../native/Tooltip.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-slate-900");
  });

  it("mantém o círculo h-10 w-10 e o fallback bg-muted", () => {
    const source = readFileSync(new URL("./Avatar.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("h-10 w-10 shrink-0 overflow-hidden rounded-full");
    expect(source).toContain("aspect-square h-full w-full");
    expect(source).toContain("rounded-full bg-muted");
    const native = readFileSync(new URL("../native/Avatar.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("h-10 w-10");
  });
});
