import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("FilterIndicator", () => {
  it("mantém Funnel, text-orange-500 e text-gray-500 no web; nativo sem Tailwind", () => {
    const source = readFileSync(
      new URL("./FilterIndicator.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Funnel");
    expect(source).toContain("text-orange-500");
    expect(source).toContain("text-gray-500");
    expect(source).toContain("h-10");
    const native = readFileSync(
      new URL("../native/FilterIndicator.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("useTheme");
    expect(native).toContain("theme.focus");
    expect(native).not.toContain("text-orange-500");
    expect(native).not.toContain("text-gray-500");
    expect(native).not.toContain("className");
  });
});
