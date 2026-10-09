import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RadioGroup", () => {
  it("mantém grid, border-primary e indicador Circle no web; nativo sem Tailwind", () => {
    const source = readFileSync(new URL("./RadioGroup.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("@radix-ui/react-radio-group");
    expect(source).toContain("grid gap-2");
    expect(source).toContain(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary",
    );
    expect(source).toContain('Circle className="h-2.5 w-2.5 fill-current text-current"');
    const native = readFileSync(new URL("../native/RadioGroup.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("Pressable");
    expect(native).toContain("radiogroup");
    expect(native).not.toContain("border-primary");
    expect(native).not.toContain("className");
    expect(native).not.toContain("grid gap-2");
  });
});
