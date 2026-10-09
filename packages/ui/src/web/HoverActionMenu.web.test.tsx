import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HoverActionMenu", () => {
  it("mantém group-hover, text-slate-700 e hover:text-orange-600 no web; nativo sem Tailwind", () => {
    const source = readFileSync(
      new URL("./HoverActionMenu.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("group-hover");
    expect(source).toContain("text-slate-700");
    expect(source).toContain("hover:text-orange-600");
    // Anel de foco por teclado da marca (FOCUS_RING, token --focus-ring), não mais o ring orange-500 próprio.
    expect(source).toContain("FOCUS_RING");
    expect(source).not.toMatch(/ring-orange-500|focus-visible:ring-/);
    expect(source).toContain("bg-white");
    const native = readFileSync(
      new URL("../native/HoverActionMenu.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("Pressable");
    expect(native).toContain("useTheme");
    expect(native).not.toContain("hover:text-orange-600");
    expect(native).not.toContain("text-slate-700");
    expect(native).not.toContain("className");
  });
});
