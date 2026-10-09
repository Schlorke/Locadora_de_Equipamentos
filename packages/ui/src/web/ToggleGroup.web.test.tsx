import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ToggleGroup", () => {
  it("mantém gap-1 e toggleVariants no web; nativo sem Tailwind", () => {
    const source = readFileSync(
      new URL("./ToggleGroup.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("@radix-ui/react-toggle-group");
    expect(source).toContain("flex items-center justify-center gap-1");
    expect(source).toContain("toggleVariants");
    const native = readFileSync(
      new URL("../native/ToggleGroup.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("toolbar");
    expect(native).not.toContain("gap-1");
    expect(native).not.toContain("className");
    expect(native).not.toContain("toggleVariants");
  });
});
