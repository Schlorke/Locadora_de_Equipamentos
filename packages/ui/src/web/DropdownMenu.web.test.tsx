import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DropdownMenu", () => {
  it("mantém o deslocamento 4, a camada de tooltip e o hover laranja", () => {
    const source = readFileSync(new URL("./DropdownMenu.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("sideOffset = 4");
    expect(source).toContain("z-[var(--layer-tooltip)]");
    expect(source).toContain("min-w-[8rem]");
    expect(source).toContain("hover:bg-orange-50 hover:text-orange-600");
    expect(source).toContain("h-px bg-muted");
    expect(source).toContain("filter-dropdown-scroll");
    const native = readFileSync(new URL("../native/DropdownMenu.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("hover:bg-orange-50");
  });
});
