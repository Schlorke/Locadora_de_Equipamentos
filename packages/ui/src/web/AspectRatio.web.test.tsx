import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AspectRatio", () => {
  it("reexporta o Root do Radix no web e não usa Tailwind no nativo", () => {
    const source = readFileSync(new URL("./AspectRatio.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("@radix-ui/react-aspect-ratio");
    expect(source).toContain("AspectRatioPrimitive.Root");
    expect(source).not.toContain("className");
    const native = readFileSync(new URL("../native/AspectRatio.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("aspectRatio");
    expect(native).not.toContain("className");
    expect(native).not.toContain("bg-");
  });
});
