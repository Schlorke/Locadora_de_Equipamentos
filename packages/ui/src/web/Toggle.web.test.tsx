import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Toggle", () => {
  it("mantém CVA orange e Radix no web; nativo sem Tailwind", () => {
    const source = readFileSync(new URL("./Toggle.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("@radix-ui/react-toggle");
    expect(source).toContain("hover:text-orange-600");
    expect(source).toContain("data-[state=on]:bg-orange-50");
    expect(source).toContain("data-[state=on]:text-orange-600");
    expect(source).toContain("border border-input");
    const native = readFileSync(new URL("../native/Toggle.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("accessibilityRole");
    expect(native).not.toContain("hover:text-orange-600");
    expect(native).not.toContain("bg-orange-50");
    expect(native).not.toContain("className");
  });
});
