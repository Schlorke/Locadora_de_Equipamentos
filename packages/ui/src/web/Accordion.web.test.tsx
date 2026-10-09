import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Accordion", () => {
  it("mantém borda, chevron e animações no web", () => {
    const source = readFileSync(new URL("./Accordion.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('cn("border-b", className)');
    expect(source).toContain("hover:underline [&[data-state=open]>svg]:rotate-180");
    expect(source).toContain("h-4 w-4 shrink-0 transition-transform duration-200");
    expect(source).toContain("data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down");
    expect(source).toContain("pb-4 pt-0");
    const native = readFileSync(new URL("../native/Accordion.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("border-b");
    expect(native).not.toContain("animate-accordion");
    expect(native).not.toContain("hover:underline");
  });
});
