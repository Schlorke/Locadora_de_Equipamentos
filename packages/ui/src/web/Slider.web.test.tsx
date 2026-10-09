import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Slider", () => {
  it("mantém track secondary, range primary e thumb border-primary no web; nativo sem Tailwind", () => {
    const source = readFileSync(new URL("./Slider.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("@radix-ui/react-slider");
    expect(source).toContain("relative flex w-full touch-none select-none items-center");
    expect(source).toContain(
      "relative h-2 w-full grow overflow-hidden rounded-full bg-secondary",
    );
    expect(source).toContain("absolute h-full bg-primary");
    expect(source).toContain(
      "block h-5 w-5 rounded-full border-2 border-primary bg-background",
    );
    const native = readFileSync(new URL("../native/Slider.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("adjustable");
    expect(native).not.toContain("bg-secondary");
    expect(native).not.toContain("bg-primary");
    expect(native).not.toContain("border-primary");
    expect(native).not.toContain("className");
  });
});
