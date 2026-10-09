import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Switch e Skeleton", () => {
  it("mantém as classes do interruptor web", () => {
    const source = readFileSync(new URL("./Switch.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("h-6 w-11");
    expect(source).toContain("data-[state=checked]:bg-primary");
    expect(source).toContain("data-[state=unchecked]:bg-input");
    expect(source).toContain("data-[state=checked]:translate-x-5");
    expect(source).toContain("data-[state=unchecked]:translate-x-0");
    const native = readFileSync(new URL("../native/Switch.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("h-6 w-11");
  });

  it("mantém o pulso do esqueleto web", () => {
    const source = readFileSync(new URL("./Skeleton.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("animate-pulse rounded-md bg-muted");
    const native = readFileSync(new URL("../native/Skeleton.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("animate-pulse");
  });
});
